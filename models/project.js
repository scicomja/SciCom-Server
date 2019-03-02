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

// before removing a project, delete all the applications and bookmarks to it.
ProjectSchema.pre('remove', async function(next) {
  const { _id } = this
  const { model: ApplicationModel } = require('./application')
  const { model: UserModel } = require('./user')
  // remove all applications to this project
  const appResult = await ApplicationModel.deleteMany({
    project: _id
  })
  // remove all bookmarks from students' bookmarks
  const bookmarkResult = await UserModel.updateMany({
    isPolitician: false
  }, {
    $pullAll: {
      bookmarks: [_id]
    }
  })
  next()
})

const ProjectModel = mongoose.model('Project', ProjectSchema)
// endpoints

router.get('/:id', async (req,res) => {
  const { id } = req.params
  const { _id: userId } = req.user
  const project = await ProjectModel.findOne({_id: id})
  if(!project) return notFound(res)
  console.log('get project', project)
  if(userId.equals(project.creator._id)) {
    const { model: ApplicationModel } = require('./application')
    // This is the creator of the project
    // populate application schema here
    const applicationsReceived = await ApplicationModel.find({
      project: id
    })
    return res.status(200).json({
      ...project._doc, // otherwise it gives away lots of internal stuff when spreading
      applications: applicationsReceived,
    })
  }
  return res.status(200).json(project)
})

router.delete('/:id', async (req, res) => {
  const { id } = req.params
  const { _id: userId } = req.user
  const project = await ProjectModel.findOne({_id: id})
  if(!project) return notFound(res)
  if(!userId.equals(project.creator._id)) {
    return unauthorized(res, "Only creator of the project can delete it.")
  }
  await project.remove()

  return res.status(200).json({
    "status": "deleted"
  })
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
        console.log('req.file', req.file)
        if(!_.isEmpty(req.file)) {
          details.file = req.file.filename
        } else {
          details.file = undefined
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
      const details = _.pick(req.body, Object.keys(rawSchema).filter(field => {
        // filter out those that has a lockdown in the attribute
        return !("lockdown" in rawSchema[field])
      }))
      console.log('details,', details)
      Object.keys(details).forEach(field => {
        project.set(field, details[field])
      })
      // modify file name
      let fileField = undefined
      if(!_.isEmpty(req.file)) {
        fileField = `${req.file.filename}`
      }
      project.set('file', fileField)

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
  const recognizedParams = "title,status,nature,tags,salary,from,page".split(',')
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
  /******** QUERY *********/
  if(!validateParameters(query)) {
    return badRequest(res, {message: "invalid query"})
  }
  const {page} = req.query
  // pagination settings
  const limit = 10
  const queryObject = constructQuery(query)

  // count total number of results
  const numProjects = await ProjectModel.find(queryObject).count()
  // get number of pages according to the limit
  const numPages = Math.floor(numProjects / limit)
  // actually get the results from query, sort and skip accordingly
  const results = await ProjectModel.find(queryObject)
    .sort('-createdAt')
    .skip((parseInt(page) - 1) * limit)
    .limit(limit)
  // then return results
  return res.status(200).json({results, total: numPages})
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
  let { answers } = req.body
  if(!answers ) answers = [] // answers cannot be null when inserting applications
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
  if(project.questions.length && project.questions // if there are no answers, make it as an object for easier checking
    .some(question => !Object.keys(answers || {}).includes(question))) {
      console.log('bad request:', Object.keys(answers || []), project.questions)
    return badRequest(res, "some answers to questions are missing")
  }
  // continue filling out the info
  const rawApplication = {
    applicant: ObjectId(userId),
    project: projectId,
    answers
  }
  console.log('application:', rawApplication)
  const newApplication = new ApplicationModel(rawApplication)
  try {
    await newApplication.save()
    return res.status(201).json(rawApplication)
  } catch(e) {
    console.log('error in creating application', e)
    return badRequest(res,e)
  }
})
router.post('/open/:id', async (req, res) => {
  const { id } = req.params
  const project = await ProjectModel.findOne({
    _id: id
  })
  if(!project) return notFound(res)
  if(!project.creator._id.equals(req.user._id))
    return unauthorized(res, "Only creator of the project can open / close it")

  project.set("status", "open")
  await project.save()
  return res.status(200).json(
    {status: 'open', ...project}
  )
})

router.post('/close/:id', async (req, res) => {
  const { id } = req.params
  const project = await ProjectModel.findOne({
    _id: id
  })
  if(!project) return notFound(res)
  if(!project.creator._id.equals(req.user._id))
    return unauthorized(res, "Only creator of the project can open / close it")

  const result = await ProjectModel.findOneAndUpdate({
    _id:id
  }, {"status": "closed"})
  return res.status(200).json(
    {status: 'closed', ...result._doc}
  )
})

// endpoint for marking a project as "completed"
router.post('/complete/:id', async (req, res) => {
  const { id } = req.params
  const project = await ProjectModel.findOne({
    _id: id
  })
  if(!project) return notFound(res)
  if(!project.creator._id.equals(req.user._id))
    return unauthorized(res, "Only creator of the project can open / close it")

  if(project.status !== "closed") {
    return badRequest(res, "Project cannot be completed if it is not closed")
  }

  const result = await ProjectModel.findOneAndUpdate({
    _id: id
  }, {"status": "completed"})

  return res.status(200).json(result._doc)
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
  // check if there we have the bookmark
  const { model: UserModel } = require('./user')
  const { username } = req.user
  const result = await UserModel.findOne({
    username,
    bookmarks: projectId
  })

  if(!result) {
    // the bookmark isn't there, add it.
    await UserModel.findOneAndUpdate({ username }, {
      $push: {bookmarks: ObjectId(projectId)}
    })
    return res.status(201).json({
      "message": "bookmark added"
    })
  } else {
    // bookmark is there, remove it.
    await UserModel.findOneAndUpdate({ username }, {
      $pull: {bookmarks: ObjectId(projectId)}
    })
    return res.status(200).json({
      message: "bookmark removed"
    })
  }
})
// the rest is for serving the file of the projects
router.get('*', express.static(projectDir))
module.exports = {
  router,
  model: ProjectModel
}
