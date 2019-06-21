// endpoints dedicated to the new searching algorithm.
const { model: UserModel } = require("./user")
const { model: ProjectModel } = require("./project")
const { ApplicationModel } = require("./application")
const { unauthorized, badRequest } = require("../utils")
const { projectType } = require("../constants")

const _ = require("lodash")
const express = require("express")
const Yup = require("yup")
const router = express.Router()

const validatePayload = async payload => {
	try {
		await Yup.object()
			.shape({
				searchTerm: Yup.string(),
				salary: Yup.string()
					.oneOf(["REQUIRED", "NOT_REQUIRED", "DOES_NOT_MATTER", null])
					.nullable(),
				type: Yup.string().oneOf(projectType),
				date: Yup.date()
			})
			.validate(payload)
		return true
	} catch (err) {
		console.log("validate error", err)
		return false
	}
}

router.post("/", async (req, res) => {
	// first check the payload
	const payload = req.body
	const user = req.user
	if (!user) return unauthorized(res)
	if (!(await validatePayload(payload))) {
		return badRequest(res)
	}

	// parse and query
	const { searchTerm, salary, date, type } = payload
	if (!searchTerm && !salary && !date && !type) {
		return badRequest(res, { error: "At least one field has to be given" })
	}

	let result = {}
	// searchTerm only, users included
	if (!salary && !date && !type) {
		const userResults = await UserModel.findUsersContainingName(
			searchTerm,
			user.isPolitician
		)
		console.log("got results from db", userResults)
		result.users = userResults
	}
	// search projects in all other cases.
	result.projects = await ProjectModel.queryProject(payload)
	return res.json(result)
})

module.exports = { router }
