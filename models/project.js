const mongoose = require('mongoose')
const lockdown = require('mongoose-lockdown')
const express = require('express')
const ObjectId = require('mongoose').Types.ObjectId

const multer  = require('multer')
const fs = require('fs')
const path = require('path')

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
      validate: async (v) => {
            const user = await UserModel.findOne({_id: v})
            if(!user) return false
            return user.isPolitician
      },
      lockdown: true
  },
  from: {
    type: Date,
    required: true,
    default: new Date(),
    // make sure if there's "to", it is before that
    validate: v => !this.to || v < this.to
  },
  to: {
    type: Date,
    // make sure it is after "from"
    validate: v => v > this.from
  },
  nature: {
    type: String,
    required: true,
    default: 'internship',
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
    validate: v => v > 0
  },
  questions: [String]
}
const fileFields = ['file']
const ProjectSchema = new mongoose.Schema(
  rawSchema, {
    timestamps: true
}).plugin(lockdown)

const ProjectModel = mongoose.model('Project', ProjectSchema)
// endpoints
router.get('/:id', async (req,res) => {
  const { id } = req.params
  const project = await ProjectModel.findOne({_id: id})
  if(project.creator === req.user._id) {
    // This is the creator of the project
    // populate application schema here
  }
  if(!project) return notFound(res)
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
        // mark this as the
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
  if(!req.user._id.equals(project.creator))
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
// the rest is for serving the file of the projects 
router.get('*', express.static(projectDir))
module.exports = {
  router
}
