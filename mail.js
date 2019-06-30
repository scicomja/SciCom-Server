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
		subject: "Verifizieren Sie Ihre sci-com.org E-Mail-Adresse",
		html: `Bitte geben Sie diesen Code auf der Website ein, um die E-Mail-Adresse zu verifizieren:
		<b>${token}</b>`
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
	const statusString = status == "accepted" ? "angenommen" : "abgelehnt"
	const options = {
		from: from_email_address,
		to: toEmail,
		subject: `Ihre Bewerbung auf sci.com.org wurde ${statusString}`,
		html: `
			Ihre Bewerbung zu dem Projekt <b>${title}</b> wurde ${statusString}.
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
	let statusString = status
	switch (status) {
		case "open":
			statusString = "offen"
			break
		case "closed":
			statusString = "geschlossen"
			break
		case "completed":
			statusString = "Abgeschlossen"
			break
	}

	const options = {
		from: from_email_address,
		to: toEmail,
		subject: `Ein Projekt mit Bewerbung Ihrerseits auf sci-com.org ist ${statusString}`,
		html: `
			Das Projekt <b>${title}</b>, auf das Sie sich beworben haben ist nun ${statusString}.
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
