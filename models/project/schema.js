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
	questions: [String]
}
const fileFields = ["file"]
const ProjectSchema = new mongoose.Schema(rawSchema, {
	timestamps: true
})
	.plugin(lockdown)
	.plugin(require("mongoose-autopopulate"))

ProjectSchema.pre("validate", function(next) {
	// if (this.from < new Date()) {
	// 	return next(new Error("Start date must not be from the past"))
	// }
	if (this.to && this.from >= this.to) {
		return next(new Error("To date must be later than from date"))
	}
	next()
})

// before removing a project, delete all the applications and bookmarks to it.
ProjectSchema.pre("remove", async function(next) {
	const { _id } = this
	const { model: ApplicationModel } = require("./application")
	const { model: UserModel } = require("./user")
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
	next()
})

ProjectSchema.statics.queryProject = async function({
	searchTerm,
	salary,
	type,
	date
}) {
	let query = {}
	if (!searchTerm && !salary && !date && !type) return [] // do not return everything if the query is empty

	if (searchTerm) {
		const regexConstraint = { $regex: new RegExp(searchTerm, "i") }
		query.$or = [
			{ title: regexConstraint },
			{ description: regexConstraint },
			{ nature: regexConstraint },
			{ state: regexConstraint },
			{ type: regexConstraint },
			{ tags: regexConstraint }
		]
	}

	if(type) {
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
	return await this.find(query)
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
