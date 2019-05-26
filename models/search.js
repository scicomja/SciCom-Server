// endpoints dedicated to the new searching algorithm.
const { UserModel } = require("./user")
const { ProjectModel } = require("./project")
const { ApplicationModel } = require("./application")
const { unauthorized, badRequest } = require("../utils")

const express = require("express")
const Yup = require("yup")
const router = express.Router()

const validatePayload = async payload => {
	try {
		await Yup.object()
			.shape({
				searchTerm: Yup.string().required(),
				salary: Yup.number()
					.positive()
					.required(),
				date: Yup.date().required()
			})
			.validate(payload)
		return true
	} catch (err) {
		return false
	}
}

router.get("/", async (req, res) => {
	// first check the payload
	const payload = req.body
	const user = req.user
	if (!user) return unauthorized(res)
	if (!(await validatePayload(payload))) {
		return badRequest(res)
	}

	// parse and query
	const { searchTerm, salary, date } = payload

	let result = {}
	// searchTerm only, users included
	if (!salary && !date) {
		const userResults = await UserModel.findUsersContainingName(searchTerm)
		result.users = userResults
	}
	// search projects in all other cases.
})
