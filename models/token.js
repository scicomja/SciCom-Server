const mongoose = require("mongoose")
const { model: UserModel } = require("./user")

const tokenType = {
	RESET_PASSWORD: "RESET_PASSWORD",
	EMAIL_VERIFICATION: "EMAIL_VERIFICATION"
}

const rawSchema = {
	username: { type: String, required: true },
	type: { type: String, required: true },
	token: { type: String, required: true }
}
