const mongoose = require("mongoose")
const express = require("express")

// configure authentication
const passport = require("passport")
const passportJWT = require("passport-jwt")
const JWTStrategy = passportJWT.Strategy
const ExtractJWT = passportJWT.ExtractJwt
const bcrypt = require("bcrypt")

const { compulsoryFields, model: UserModel } = require("./user")
const jwt = require("jsonwebtoken")
const ExtractJwt = require("passport-jwt").ExtractJwt
const SECRET = process.env.secret || "SOME SECRET"
const { unauthorized, badRequest } = require("../utils")
const EmailValidator = require("email-validator")
const swot = require("swot-js")()

const { TokenModel, tokenType: TokenType } = require("./token")
const Mail = require("../mail")

// configure authentication strategy
passport.use(
	new JWTStrategy(
		{
			jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
			secretOrKey: SECRET
		},
		({ username }, cb) => {
			//find the user in db if needed. This functionality may be omitted if you store everything you'll need in JWT payload.
			return UserModel.findOne({ username })
				.then(user => {
					if (!user) {
						return cb(null, false, {
							error: "unauthorized"
						})
					}
					return cb(null, user)
				})
				.catch(err => {
					return cb(err)
				})
		}
	)
)
// custom middleware to give json as 403 response
const authenticateMiddleware = (req, res, next) => {
	// add exceptions to some of the endpoints
	// no authorization required for files for project.
	if (
		RegExp("^/project/[0-9a-f]{24}/.*.(pdf|jpg|jpeg|gif|png|tiff)").test(
			req.originalUrl
		)
	) {
		return next()
	}
	// no authorization required for CV or avatar
	if (RegExp("^/user/.*/(CV.pdf|avatar)$").test(req.originalUrl)) {
		return next()
	}
	// if(req.path == '/project/')
	passport.authenticate("jwt", (err, user, info) => {
		if (err) return next(err) // It is null
		if (!user)
			return res.status(403).json({
				error: "unauthorized"
			})
		req.user = user
		next(err)
	})(req, res, next)
}
const router = express.Router()
const signUser = username => jwt.sign({ username }, SECRET, {})

router.post("/register", async (req, res) => {
	const info = req.body

	if (!info) {
		return res.status(400).json({
			error: "missing post data"
		})
	}

	const { username, email, password, isPolitician } = info

	// check compulsory fields
	if (compulsoryFields.some(f => !(f in info))) {
		return res.status(400).json({
			error: "Benutzername oder Passwort fehlt."
		})
	}
	// check if user exists
	const existUsers = await UserModel.find().or([{ username }, { email }])
	if (existUsers.length > 0) {
		return res.status(400).json({
			error:
				"Ein Account mit diesem Benutzernamen oder dieser Email-Adresse existiert bereits."
		})
	}
	// check if email is valid
	if (!EmailValidator.validate(email)) {
		return res.status(400).json({
			error: "Email-Adresse ist ungültig"
		})
	}
	// additionally, if he is a student, check student's email address
	if (!isPolitician && !swot.check(email)) {
		return res.status(400).json({
			error:
				'Angegebene Email-Adresse ist kein Universitäts-Account. Bitte benutzen Sie z. B. eine "@tum.de"-Adresse.'
		})
	}
	/**
		Send a email verification, and user is required to input this through a popup
	*/
	const verificationToken = await TokenModel.createEmailVerificationEntry(email)
	await Mail.sendVerificationEmail({ email, token: verificationToken })

	try {
		const result = await UserModel.create({
			username,
			email,
			password,
			isPolitician
		})
		return res.status(200).json({
			status: "ok" // DO NOT signin the user here.
		})
	} catch (err) {
		return badRequest(res, err)
	}
})

router.post("/login", async (req, res) => {
	const info = req.body
	const invalidate = () =>
		res.status(401).json({
			error: "Benutzername oder Passwort ungültig"
		})

	if (!info) {
		return res.status(400).json({
			error: "missing post data"
		})
	}
	const { username, password } = info
	const user = await UserModel.findOne({
		username
	}).select({
		username: 1,
		password: 1,
		verified: 1
	})
	if (!user) return invalidate()
	if (!user.verified) {
		return res.status(401).json({
			error: "Das Profil ist nicht verifiziert."
		})
	}
	bcrypt.compare(password, user.password, (err, isMatch) => {
		if (err || !isMatch) return invalidate()
		const token = signUser(username)
		return res.status(200).json({ token })
	})
})

/*
  Endpoint for changing password
  takes: {
    originalPassword: String,
    newPassword: String,
  }
*/
router.post(
	"/changePassword",
	authenticateMiddleware, // requires authentication here
	async (req, res) => {
		const { username } = req.user
		const { originalPassword, newPassword } = req.body
		if (!originalPassword || !newPassword) {
			return badRequest(res, { error: "Missing required field" })
		}
		// get the hased existing password
		const { password: realPassword } = await UserModel.findOne({
			username
		}).select({ password: 1 })
		bcrypt.compare(originalPassword, realPassword, async (err, isMatch) => {
			if (err || !isMatch) return unauthorized(res, "Password is not correct")
			// the password is right, now update it
			try {
				const user = await UserModel.findOne({
					username
				}).select({ password: 1 })
				user.password = newPassword
				const result = await user.save()
				return res.status(200).json({
					status: "ok"
				})
			} catch (err) {
				return res.status(500).json({
					error: "internal server error"
				})
			}
		})
	}
)
/**
	Given a email address, token sent in the email, and a the new password, update the record associated to the account.

	@response: { updated: boolean }
	@request: { email: String, token: String, password: String}

*/
router.post("/setPassword", async (req, res) => {
	const { email, token, password: newPassword } = req.body
	const foundRecord = await TokenModel.matchToken({
		email,
		type: TokenType.RESET_PASSWORD,
		token
	})
	// return if the record is not found.
	if (!foundRecord) {
		console.log("set password: record not found.")
		return res.json({ updated: false })
	}

	// the token should be removed at this point, now change the password.

	// user cannot be empty here
	try {
		const user = await UserModel.findOne({ email })
		// actual update password here
		user.password = newPassword
		// use save to trigger the password hashing
		await user.save()

		return res.json({ updated: true })
	} catch (err) {
		console.log("error at set password", err)
		return res.json({ updated: false })
	}
})

/**
  Given a email address, create a token and store it to database, and return the token
*/
router.post("/resetPassword", async (req, res) => {
	const { email } = req.body
	console.log("email", email)
	const foundUser = await UserModel.findOne({ email })
	// if there is no such user with this email. do nothing
	// because otherwise people can use this to spoof which email address is registered.
	if (!foundUser) return res.json({})
	console.log("find user")
	// the user is found.
	const { username } = foundUser
	try {
		// create a token and store it in database
		const token = await TokenModel.createResetPasswordEntry(email)
		// then wait for sending email.
		await Mail.sendResetPasswordEmail({
			account: { username, email },
			token
		})
	} catch (err) {
	} finally {
		return res.json({})
	}
})

/**
	Endpoint for the user to reply to the email verifcation challenge.

*/

router.post("/verifyEmail", async (req, res) => {
	const { email, token } = req.body

	const verified = await TokenModel.matchToken({
		email,
		token,
		type: TokenType.EMAIL_VERIFICATION
	})
	/* TODO: remove the 'abc' god token! */
	if (!verified && token != "abc") {
		return unauthorized(res, "verification failed")
	} else {
		const { username } = await UserModel.verifyUser(email)
		if (!username) {
			return badRequest(res) // what?
		}

		const token = signUser(username)
		// now show the display message
		return res.status(201).json({
			token
		})
	}
})
module.exports = {
	router,
	authenticateMiddleware
}
