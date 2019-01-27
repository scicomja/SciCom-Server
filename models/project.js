const mongoose = require('mongoose')
const lockdown = require('mongoose-lockdown')
const express = require('express')
const ObjectId = require('mongoose').Types.ObjectId

const multer  = require('multer')
const fs = require('fs')
const path = require('path')

// const { ApplicationModel } = require('./application')

const {
  validateParameters,
  constructQuery
} = require('./validator/project')
const {
  germanStates,
  projectStatus,
  projectType,
  projectDir
} = require('../constants')
const {
  badRequest, unauthorized, notFound,
  generateID
} = require('../utils')

const _ = require('lodash')

const { model: UserModel } = require('./user')

const router = express.Router()

const rawSchema = {
  title: { type: String, required: true},
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
      ref: 'User',
      required: true,
      lockdown: true,
      autopopulate: true
  },
  from: {
    type: Date,
    required: true,
    default: new Date(),
    // make sure if there's "to", it is before that
    // validate: v => !v.to || new Date(v.from) < new Date(v.to)
  },
  to: {
    type: Date,
    // make sure it is after "from"
    // validate: v => {
    //   return new Date(v.to) > new Date(v.from)
    // }
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
  topic: [String],
  salary: {
    type: Number,
    default: 0,
    validate: v => v >= 0
  },
  questions: [String]
}
const fileFields = ['file']
const ProjectSchema = new mongoose.Schema(
  rawSchema, {
    timestamps: true
})
.plugin(lockdown)
.plugin(require('mongoose-autopopulate'))

ProjectSchema.pre('validate', function(next) {
  console.log("pre validate", this)
  if(this.from < new Date()) {
    return next(new Error("Start date must not be from the past"))
  }
  if (this.to && this.from >= this.to) {
    return next(new Error("To date must be later than from date"))
  }
  next()
})

const ProjectModel = mongoose.model('Project', ProjectSchema)
// endpoints

router.get('/:id', async (req,res) => {
  const { id } = req.params
  const { _id: userId } = req.user
  const project = await ProjectModel.findOne({_id: id})
  if(!project) return notFound(res)
  if(userId.equals(project.creator._id)) {
    const { model: ApplicationModel } = require('./application')
    // This is the creator of the project
    // populate application schema here
    const applicationsReceived = await ApplicationModel.find({
      project: id
    })
    return res.status(200).json({
      ...project._doc, // otherwise it gives away lots of internal stuff when spreading
      applications: applicationsReceived
    })
  }
  return res.status(200).json(project)
})


// configure storage options
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = `${projectDir}${req.params.id}/`
    if(!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir)
    }
    if(!fs.existsSync(dir)) {
      fs.mkdirSync(dir)
    }

    cb(null, dir)
  },

  filename: (req, file, cb) => {
    cb(null, file.originalname)
  }
})

const upload = multer({
  storage,
  // allows only accepted mimetype
  fileFilter: (req, file, cb) => {
    const types = /jpeg|jpg|png|gif|pdf/
    if(!types.test(file.mimetype)) {
      return cb(new Error(`Unaccepted mimetype: ${file.mimetype}`))
    }
    cb(null, true)
  }
}).single('file')

// creating a project
router.post('/',
  // small middle where to fill in a custom id for the project
  async (req, res, next) => {
    const id = await generateID(ProjectModel)
    req.params.id = id
    next()
  },
  async (req,res) => {
    if(!req.user.isPolitician) {
      return res.status(403).json({
        error: "Only politicians can create projects"
      })
    }

    // perform uploading
    upload(req, res, async err => {
        if(err) return badRequest(res, err)
        const details = _.pick(req.body, Object.keys(rawSchema))
        if(req.file) {
          details.file = `${projectDir}${req.params.id}`
        }
        // mark the creator and id of the project
        details.creator = req.user._id
        details._id = req.params.id
        try {
          const project = new ProjectModel(details)
          await project.save()
          return res.status(201).json(details)
        } catch(err) {
            return badRequest(res, {error: err.message})
        }
    })
})
// getting files for a project
// modifying a project
router.post('/:id', async (req,res) => {
  const {id} = req.params
  const project = await ProjectModel.findOne({_id: id})
  if(!project) return notFound(res)
  if(!req.user._id.equals(project.creator._id))
    return unauthorized(res)

  upload(req, res, async err => {
      if(err) return badRequest(res, err)
      const details = _.pick(req.body, Object.keys(rawSchema))
      Object.keys(details).forEach(field => {
        project.set(field, details[field])
      })
      // modify file name
      if(!req.file) {
        details.file = undefined
      } else {
        details.file = `${req.file.originalname}`
      }

      try {
        project.save()
        return res.status(200).json(details)
      } catch(err) {
          return badRequest(res, {error: err.message})
      }

  })
})
/*
  search for projects
  get params:
  title: substring,
  status: exact string
  nature: exact string
  salary: number, show results >=
  from: date: show results on or after
  page: number, positive integer
*/
router.get('/', async (req,res) => {
  // extract query
  const recognizedParams = "title,status,nature,salary,from,page".split(',')
  const query = _.pick(req.query, recognizedParams)

  if(Object.keys(query).length === 0) {
    // when no parameters are given, get the list of projects created / applied by user
    const { _id: id, isPolitician } = req.user
    if(isPolitician) {
      // give list of projects created by him.
      const createdProjects = await ProjectModel.find({creator: id})
      return res.status(200).json(createdProjects)
    } else {
      // give list of projects applied by him.
      const { model: ApplicationModel } = require('./application')
      const appliedProjects = await ApplicationModel.find({ applicant: id})
                                .populate('project')
                                .select('project')
      return res.status(200).json(appliedProjects)
    }
  }
  if(!validateParameters(query)) {
    return badRequest(res, {message: "invalid query"})
  }
  const {page} = req.query
  const limit = 10
  const queryObject = constructQuery(query)
  // pagination settings
  // check the types one by one

  const results = await ProjectModel.find(queryObject)
    .sort('-createdAt')
    .skip((parseInt(page) - 1) * limit)

  return res.status(200).json(results)
})

// submit an application to a project
// id is refering to a project
router.post('/apply/:id', async (req,res) => {
  // now the application model is needed
  const { model: ApplicationModel } = require('./application')

  // only students can apply
  if(req.user.isPolitician) {
    return unauthorized(res,
      "politicians cannot apply for projects"
    )
  }
  const { answers } = req.body
  const { _id: userId } = req.user

  const { id: projectId } = req.params
  // check if the project exists
  const project = await ProjectModel.findOne({
    _id: projectId
  }).populate('creator')
  if(!project) return notFound(res)
  // check if the application exists...
  const application = await ApplicationModel.findOne({
    applicant: userId,
    project: projectId
  })
  // treat this as removing the application if exists
  if(application) {
    await application.remove()
    return res.status(200).json({
      message: 'removed',
      ...application // give back the details of the application
    })
  }
  // otherwise user is applying for such project
  // check if the applicant has answered all questions
  if(Object.keys(answers || {}) // if there are no answers, make it as an object for easier checking
    .some(question => !(question in application.questions))) {
    return badRequest(res, "some answers to questions are missing")
  }
  // continue filling out the info
  const rawApplication = {
    applicant: ObjectId(userId),
    project: projectId,
    answers
  }
  const newApplication = new ApplicationModel(rawApplication)
  try {
    await newApplication.save()
    return res.status(201).json(rawApplication)
  } catch(e) {
    return badRequest(res,e)
  }
})
router.post('/bookmark/:id', async (req, res) => {
  if(req.user.isPolitician) {
    return unauthorized(res, "only students can bookmark projects")
  }
  // check if project exists
  const {id: projectId} = req.params
  const project = await ProjectModel.findOne({
    _id: projectId
  })
  if(!project) return notFound(res)

  const remainingBookmarks = req.user.bookmarks
      .filter(bm => !bm._id.equals(projectId))
  const ids = remainingBookmarks.map(bm => bm._id)
  if(remainingBookmarks.length != req.user.bookmarks.length) {
    // bookmark already exists
    req.user.set("bookmarks", ids)
    await req.user.save()
    return res.status(200).json(remainingBookmarks)
  } else {
    // bookmark hasnt been added.
    ids.push(ObjectId(projectId))
    req.user.set("bookmarks", ids)
    await req.user.save()
    return res.status(200).json([...remainingBookmarks, project])
  }

})
// the rest is for serving the file of the projects
router.get('*', express.static(projectDir))
module.exports = {
  router,
  model: ProjectModel
}
