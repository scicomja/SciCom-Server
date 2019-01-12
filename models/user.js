const mongoose = require('mongoose')
const express = require('express')
const bcrypt = require('bcrypt')
const passport = require('passport')

const _ = require('lodash')

const multer  = require('multer')
const fs = require('fs')
const path = require('path')

const upload = multer({ dest: 'uploads/' })
const {
  unauthorized, notFound
} = require('../utils')

const router = express.Router()
// schema definition

const rawSchema = {
  // basic info
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true},
  password: { type: String, select: false, required: true },
  isPolitician: {type: Boolean, required: true, default: false},

  avatar: String,
  // contacts
  phone: String,
  website: String,
  linkedIn: String,
  // locations
  city: String,
  state: String,

  // optional info
  title: String,
  major: {
    type: [String],
    // this field is for students only
    validate: {
      validator: (v) => !this.isPolitician
    }
  },
  university: {
    type: String,
    // this field is for students only
    validate: {
      validator: (v) => !this.isPolitician
    }
  },
  CV: {
    type: String,
    validate: {
      validator: (v) => !this.isPolitician
    }
  },
  position: {
    type: String,
    validate: {
      validator: (v) => this.isPolitician
    }
  }
}
const compulsoryFields = 'username,password,isPolitician'.split(',')
const optionalFields = _.differenceWith(Object.keys(rawSchema), compulsoryFields, _.isEqual)
const fileFields = "avatar,CV".split(',')

// finally, create the schema
const UserSchema = new mongoose.Schema(rawSchema)

UserSchema.pre('save', function(next) {
    const user = this
    // only hash the password if it has been modified (or is new)
    if (!user.isModified('password')) return next()
    // generate a salt
    bcrypt.genSalt(10, function(err, salt) {
        if (err) return next(err)
        // hash the password using our new salt
        bcrypt.hash(user.password, salt, function(err, hash) {
            if (err) return next(err)
            // override the cleartext password with the hashed one
            user.password = hash
            next()
        })
    })
})

UserSchema.methods.comparePassword = function(candidatePassword) {
  const prom = (resolve, reject) => {
        const password = this.password
        console.log('password in prom', password)
  }
  console.log('password in can', this.password)
  return new Promise(prom.bind(UserSchema))
}

const UserModel = mongoose.model('User',UserSchema)

// endpoints
router.get('/:username', async (req, res) => {
  if(!req.user) return unauthorized(res)
  const {username} = req.params
  const user = await UserModel.findOne({username})
  if(!user) return notFound(res)
  return res.status(200).json(user)
})

router.post('/:username',upload.fields([
    {name: "avatar"},
    {name: "CV"}
  ]), async (req, res) => {
    // first check if the user is modifying info of himself
    const { username } = req.params
    if (req.user.username !== username) {
      return unauthorized(res)
    }

    // parsing params
    const normalFields = _.differenceWith(optionalFields, fileFields, _.isEqual)
    const info = _.pick(req.body, normalFields)
    // for each file, we create a
    const result = await UserModel.findOneAndUpdate({username}, info)

    return res.status(200).json({
      ...req.user,
      ...info
    })
})

module.exports = {
  router,
  model: UserModel,
  schema: UserSchema
}
