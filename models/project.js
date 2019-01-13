const mongoose = require('mongoose')
const express = require('express')

const multer  = require('multer')
const fs = require('fs')
const path = require('path')
const { germanStates } = require('../constants')
const _ = require('lodash')
const {
  badRequest, unauthorized, notFound
} = require('../utils')
const { model: UserModel } = require('./user')
const router = express.Router()

const rawSchema = {
  title: { type: String, required: true},
  description: String,
  creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      validate: async (v) => {
            const user = await UserModel.findOne({_id: v})
            if(!user) return false
            return user.isPolitician
      }
  },
  from: {
    type: Date,
    required: true,
    default: new Date()
  },
  to: Date,
  // status: {
  //   type: String,
  //   required: true
  //   enum: ['']
  // },
  nature: {
    type: String,
    required: true,
    default: 'internship',
    enum: [
      'internship',
      'thesis',
      'parttime',
      'voluntary'
    ]
  },
  state: {
    type: String,
    enum: germanStates
  },
  topic: [String],
  salary: Number,
  questions: {
    type: [String]
  }
}

const ProjectSchema = new mongoose.Schema(
  rawSchema, {
    timestamps: true
  })

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

// creating a project
router.post('/', async (req,res) => {
  if(!req.user.isPolitician) {
    return res.status(403).json({
      error: "Only politicians can create projects"
    })
  }
  const details = _.pick(req.body, Object.keys(rawSchema))
  // mark this as the
  console.log(req.user)
  details.creator = req.user._id
  try {
    const project = new ProjectModel(details)
    await project.save()
    return res.status(201).json(project)
  } catch(err) {
      return badRequest(res, {error: err.message})
  }
})

// modifying a project

// retrieving applications of a project

module.exports = {
  router
}
