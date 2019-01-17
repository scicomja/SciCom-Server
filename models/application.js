const mongoose = require('mongoose')
const lockdown = require('mongoose-lockdown')

const express = require('express')
const ObjectId = require('mongoose').Types.ObjectId

const {
  badRequest, unauthorized, notFound
} = require('../utils')
const { applicationStatus } = require('../constants')
const { model: UserModel } = require('./user')
const { model: ProjectModel } = require('./project')
const router = express.Router()

const rawSchema = {
  applicant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    lockdown: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    lockdown: true
  },
  status: {
    type: String,
    required: true,
    default: applicationStatus[0],
    enum: applicationStatus
  },
  answers: {
    type: Map,
    of: String,
    required: true,
    default: [],
    // check answers to each of the questions are there
    validate: {
      validator: async function (v) {
        console.log('in validator', this.project)
        const proejct = await ProjectModel.findOne({_id: this.project})
        if(!project) return false
        console.log('validate projects', project)
        return Object.keys(v).every(q => (q in project.questions))
      },
      message: "All questions from projects should be answered"
    }
  }
}

const ApplicationSchema = new mongoose.Schema(
  rawSchema, {
    timestamps: true
}).plugin(lockdown)

const ApplicationModel = mongoose.model('Application', ApplicationSchema)

// getting info of an application
router.get('/:id', async (req, res) => {
  const { id } = req.params
  const userId = req.user._id
  const application = await ApplicationModel.findOne({
    _id: id,
    // being able to access only if user is the applicant or the creator of this project
    $or: [
      {applicant: userId},
      {"project.creator": userId}
    ]
  })
  if(!application) return notFound(res)
  return res.status(200).json(application)
})


// get related applications of the user
/*
  Logic is even more complicated:
    - if user is a student, get a list of of applications he applied for.
    - otherwise, get a list of applications he received
*/
router.get('/', async (req, res) => {
  const { isPolitician } = req.user
  if(!isPolitician) {
    // go for something easier first...
    const submittedApplications = await ApplicationModel.find({
      'applicant': req.user._id
    })
    return res.status(200).json(submittedApplications)
  } else {
    /*
        Searching for all applications, which is the project of the pro
    */
    const createdProjects = await ProjectModel.find({
      creator: req.user._id
    }, "_id")
    // which is list of ids of the projects this user(politician) created.
    const receivedApplications = await ApplicationModel.find({
      'project.creator': {$in: createdProjects}
    })

    return res.status(200).json(receivedApplications)
  }
})
module.exports = {
  router,
  ApplicationModel,
  schema: ApplicationSchema
}
