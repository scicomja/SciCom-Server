// file that summarises all email functionalities needed.
const nodemailer = require("nodemailer")
const { projectStatus, applicationStatus } = require("./constants")

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
		subject: "Passwort auf sci-com.org zurücksetzen",
		html: `
		Der Benutzername Ihres Accounts ist <b>${username}</b> und Ihr Verifikations-Code <b>${token}</b>. Bitte geben Sie diesen Code auf der Website ein, um ihr Passwort zurückzusetzen.`
	}
	// let the error throws from here so the caller is going to catch it.
	try {
		return await sendEmail(options)
	} catch (err) {
		return {}
	}
}

const sendVerificationEmail = async ({ email: toEmail, token }) => {
	const options = {
		from: from_email_address,
		to: toEmail,
		subject: "Verify your email address on sci-com.org",
		html: `
			Enter the token below to verify your email address:
			<b>${token}</b>
		`
	}

	try {
		return await sendEmail(options)
	} catch (err) {
		return {}
	}
}

const reportApplicationStatus = async ({
	account: { email: toEmail },
	project: { _id, title },
	status
}) => {
	if (status != "accepted" && status != "rejected") {
		return
	}

	const options = {
		from: from_email_address,
		to: toEmail,
		subject: `Your application on sci-com.org is ${status}`,
		html: `
			This email is to notify you that your application to the project <b>${title}</b> is being ${status}.
		`
	}

	try {
		return await sendEmail(options)
	} catch (err) {
		console.log("err", err)
		return {}
	}
}

const reportProjectStatus = async ({
	account: { email: toEmail },
	project: { title },
	status
}) => {
	// if(projectStatus.indexOf(status) < 0) return

	const options = {
		from: from_email_address,
		to: toEmail,
		subject: `The project you have applied for on sci-com.org is ${status}`,
		html: `
			This email is to notify you that one of the projects you have applied for, <b>${title}</b>, is now ${status}.
		`
	}
	try {
		return await sendEmail(options)
	} catch (err) {
		console.log("err", err)
		return {}
	}
}

module.exports = {
	sendResetPasswordEmail,
	sendVerificationEmail,
	reportApplicationStatus,
	reportProjectStatus
}
