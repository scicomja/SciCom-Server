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
    lockdown: true,
    autopopulate: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    lockdown: true,
    autopopulate: true
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
  }
}

const ApplicationSchema = new mongoose.Schema(
  rawSchema, {
    timestamps: true
})
.plugin(lockdown)
.plugin(require('mongoose-autopopulate'))

const ApplicationModel = mongoose.model('Application', ApplicationSchema)

// getting info of an application
router.get('/:id', async (req, res) => {
  const { id } = req.params
  const userId = req.user._id
  const application = await ApplicationModel.findOne({
    _id: id
  }).populate("project")
  if(!application) return notFound(res)
  if(req.user.isPolitician && !userId.equals(application.project.creator._id)) {
    return unauthorized(res)
  }
  if(!req.user.isPolitician && !userId.equals(application.applicant._id)) {
    return unauthorized(res)
  }
  return res.status(200).json(application)

})

router.post('/:id/accept', async (req, res) => {
  if (!req.user.isPolitician) {
    return unauthorized(res, "only politicians can accept applications")
  }
  const { id: applicationId } = req.params
  const { _id: id } = req.user
  const application = await ApplicationModel.findOne({
    _id: applicationId
  }).populate('project')
  if(!application) return notFound(res)

  if(!id.equals(application.project.creator._id)) {
    return unauthorized(res)
  }

  application.set("status", "accepted")
  await application.save()
  return res.status(200).json(application)
})

router.post('/:id/reject', async (req, res) => {
  if (!req.user.isPolitician) {
    return unauthorized(res, "only politicians can accept applications")
  }
  const { id: applicationId } = req.params
  const { _id: id } = req.user
  const application = await ApplicationModel.findOne({
    _id: applicationId
  }).populate('project')
  if(!application) return notFound(res)

  if(!id.equals(application.project.creator._id)) {
    return unauthorized(res)
  }

  application.set("status", "rejected")
  await application.save()
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
        Searching for all applications, which is the project of the politician
    */
    const createdProjects = await ProjectModel.find({
      creator: req.user._id
    }, "_id")
    // which is list of ids of the projects this user(politician) created.
    const receivedApplications = await ApplicationModel.find({
      'project': {$in: createdProjects}
    })

    return res.status(200).json(receivedApplications)
  }
})
module.exports = {
  router,
  model: ApplicationModel,
  schema: ApplicationSchema
}
