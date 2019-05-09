const mongoose = require("mongoose")
const { cryptoSecureRandomString } = require("../utils")

const { model: UserModel } = require("./user")

const tokenType = {
	RESET_PASSWORD: "RESET_PASSWORD",
	EMAIL_VERIFICATION: "EMAIL_VERIFICATION"
}

const rawSchema = {
	email: { type: String, required: true },
	type: { type: String, required: true },
	token: { type: String, required: true }
}

const validatePayload = payload => {
	return !Object.keys(rawSchema).some(key => !payload.hasOwnProperty(key))
}
const schema = new mongoose.Schema(rawSchema)
/**
	Static methods for creating a reset password entry.
	this generates a token - email pair, and save it to the database.
	If the same type(RESET_PASSWORD) of request has been done by the same email, it will be replaced with the updated token.

	@returns Promise that resolves to be a newly generated token
	@throws Error during the `findOneAndUpdate` call
*/

schema.statics.createResetPasswordEntry = function(email) {
	const type = tokenType.RESET_PASSWORD
	const token = cryptoSecureRandomString()
	return new Promise((resolve, reject) => {
		this.findOneAndUpdate(
			{ type, email }, // query
			{ token }, // update
			{ upsert: true }, // options
			(err, thing) => {
				// callback: things that is tweaked.
				if (err) reject(err)
				else resolve(token)
			}
		)
	})
}

schema.statics.queryToken = async function(thing, cb) {
	if (!validatePayload(thing)) return false

	const hasResult = await this.findOne(thing)
	return !!hasResult
}
/**
	Given a token - email - tokenType pair, check if there are records matching this token.
	If there is, remove it from database and return true.
	otherwise return false.
*/
schema.statics.matchToken = async function(thing, cb) {
	// check if all the keys in rawSchema are given in the "thing"
	if (!validatePayload(thing)) return false

	const matchingObject = await this.findOne(thing)
	if (!matchingObject) return false

	// object matches, remove entry and return true.
	await matchingObject.remove()
	return true
}

const TokenModel = mongoose.model("Token", schema)

module.exports = {
	TokenModel,
	schema,
	tokenType
}
