// file that summarises all email functionalities needed.
const nodemailer = require("nodemailer")
const {
	email_user,
	email_password,
	from_email_address = "noreply@sci-com.org"
} = process.env

const transporter = nodemailer.createTransport({
	service: "Gmail",
	auth: {
		user: email_user,
		pass: email_password
	}
})

const sendEmail = option =>
	new Promise((resolve, reject) => {
		transporter.sendMail(option, (err, info) => {
			if (err) reject(err)
			else resolve(info)
		})
	})

const sendResetPasswordEmail = async ({
	account: { email: toEmail, username },
	token
}) => {
	const options = {
		from: from_email_address,
		to: toEmail,
		subject: "Your password reset on sci-com.org",
		html: `
			Your token is ${token}. Please input this token to the checkbox to reset your password.
    `
	}
	// let the error throws from here so the caller is going to catch it.
	try {
		return await sendEmail(options)
	} catch (err) {
		// transporter is not created.
		return {}
	}
}

module.exports = {
	sendResetPasswordEmail
}
