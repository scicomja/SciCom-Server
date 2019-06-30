const mongoose = require("mongoose")
const lockdown = require("mongoose-lockdown")
const { germanStates, projectStatus, projectType } = require("../../constants")

const rawSchema = {
	title: { type: String, required: true },
	description: String,
	status: {
		type: String,
		required: true,
		default: projectStatus[0],
		enum: projectStatus
	},
	file: String,
	creator: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		required: true,
		lockdown: true,
		autopopulate: true
	},
	from: {
		type: Date,
		required: true,
		default: new Date()
		// make sure if there's "to", it is before that
		// validate: v => !v.to || new Date(v.from) < new Date(v.to)
	},
	to: {
		type: Date
	},
	nature: {
		type: String,
		required: true,
		default: projectType[0],
		enum: projectType
	},
	state: {
		type: String,
		default: germanStates[0],
		enum: germanStates
	},

	tags: [String],
	salary: {
		type: Number,
		default: 0,
		validate: v => v >= 0
	},

	workingHours: {
		type: Number,
		default: 0,
		validate: v => v >= 0
	},

	location: String,
	partyMembership: String,
	qualification: String,

	questions: [String]
}
const fileFields = ["file"]
const ProjectSchema = new mongoose.Schema(rawSchema, {
	timestamps: true
})
	.plugin(lockdown)
	.plugin(require("mongoose-autopopulate"))

ProjectSchema.pre("validate", function(next) {
	if (this.to && this.from >= this.to) {
		return next(
			new Error("Spätester Endttermin muss nach frühestem Starttermin liegen.")
		)
	}

	if (!this.file && !this.description && this.nature != "quick-question") {
		return next(
			new Error(
				"Bitte geben Sie entweder eine Beschreibung ein oder laden Sie eine zusätzliche Datei hoch."
			)
		)
	}
	next()
})

// before removing a project, delete all the applications and bookmarks to it.
ProjectSchema.pre("remove", async function(next) {
	const { _id } = this
	const { model: ApplicationModel } = require("../application")
	const { model: UserModel } = require("../user")
	const { reportProjectStatus } = require("../../mail")
	const ObjectId = require("mongoose").Types.ObjectId
	// notify uers for delecting
	const applications = await ApplicationModel.find({ project: ObjectId(_id) })
	// remove all applications to this project
	const appResult = await ApplicationModel.deleteMany({
		project: _id
	})
	// remove all bookmarks from students' bookmarks
	const bookmarkResult = await UserModel.updateMany(
		{
			isPolitician: false
		},
		{
			$pullAll: {
				bookmarks: [_id]
			}
		}
	)

	await Promise.all(
		applications.map(({ applicant }) =>
			reportProjectStatus({
				account: applicant,
				project: this,
				status: "deleted"
			})
		)
	)
	next()
})

ProjectSchema.statics.newestProject = function(numProject = 5) {
	return this.find({})
		.sort({ createdAt: -1 })
		.limit(numProject)
}

ProjectSchema.statics.queryProject = async function({
	searchTerm,
	salary,
	type,
	date
}) {
	let query = {}
	if (!searchTerm && !salary && !date && !type) return [] // do not return everything if the query is empty
	const otherQuery = originalQuery => {
		let query = Object.assign({}, originalQuery)
		if (type) {
			query.nature = type
		}

		// filter according to whether the salary is given or not
		if (salary == "REQUIRED") {
			query.salary = { $gt: 0 } // this field indicates whether the salary is included or not
		} else if (salary == "NOT_REQUIRED") {
			query.salary = { $eq: 0 }
		}

		if (date) {
			query.from = { $gte: new Date(date) }
		}
		return query
	}

	if (searchTerm) {
		const results = await Promise.all(
			searchTerm.split(" ").map(async searchTerm => {
				const regexConstraint = { $regex: new RegExp(searchTerm, "i") }
				query.$or = [
					{ title: regexConstraint },
					{ description: regexConstraint },
					{ nature: regexConstraint },
					{ state: regexConstraint },
					{ type: regexConstraint },
					{ tags: regexConstraint }
				]
				query = otherQuery(query)
				return await this.find(query)
			})
		)

		const flattenedResults = results.reduce(
			(finalResults, res) => [...finalResults, ...res],
			[]
		)
		let uniqueIds = []
		for (let res in flattenedResults) {
			const result = flattenedResults[res]
			if (uniqueIds.filter(res => res._id.equals(result._id)).length == 0) {
				uniqueIds.push(result._id)
			}
		}
		const finalResults = uniqueIds // take out the unit ids
			.map(id => flattenedResults.filter(res => res._id.equals(id))[0]) // get back all results

		return finalResults
	} else {
		query = otherQuery(query)
		return await this.find(query)
	}
}

/**
	return null if there are no errors, otherwise a string describing the error
*/
ProjectSchema.statics.setProjectStatus = async function({
	user, // user that submits this request
	id, // the id of the project of which the status needs to be changed
	status // the status you want to change to
}) {
	if (!user || !id || !status) {
		return { error: "Missing data" }
	}
	if (projectStatus.indexOf(status) < 0) {
		return { error: "Unrecognised project status" }
	}

	const project = await this.findOne({ _id: id })
	if (!project) return "Not Found"
	if (!project.creator._id.equals(user._id)) {
		return { error: "Only creator of the project can open / close it" }
	}

	// special case for 'completed' status
	if (status == "completed" && project.status !== "closed") {
		return { error: "Project cannot be completed if it is not closed" }
	}

	project.set("status", status)
	await project.save()

	return { error: null, project }
}

const ProjectModel = mongoose.model("Project", ProjectSchema)

module.exports = {
	rawSchema,
	model: ProjectModel
}
