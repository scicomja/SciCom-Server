const mongoose = require('mongoose')
const express = require('express')
const bcrypt = require('bcrypt')

const _ = require('lodash')

const multer  = require('multer')
const fs = require('fs')
const path = require('path')
const { badRequest } = require('../utils')
const {
  unauthorized, notFound
} = require('../utils')
const { userUploadDir } = require('../constants')
const { model: ApplicationModel } = require('./application')

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = `uploads/${req.params.username}`
    // create this directory if not exist
    if(!fs.existsSync(dir)) {
      fs.mkdirSync(dir)
    }
    cb(null, dir)
  },

  filename: function (req, file, cb) {
    cb(null, file.fieldname)
  }
})
const router = express.Router()
// schema definition

const rawSchema = {
  // basic info
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true},
  password: { type: String, select: false, required: true },
  isPolitician: {type: Boolean, required: true, default: false},
  // verified: { type: Boolean, required: true, default: false },

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
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const imageTypes = /jpeg|jpg|png|gif/

    if (file.fieldname === 'avatar' &&
        !imageTypes.test(file.mimetype)) {
        return cb(new Error('Only images are allowed'))
    }
    if (file.fieldname === 'CV' &&
          !/pdf/.test(file.mimetype)) {
        return cb(new Error('Only PDFs are allowed'))
    }
    cb(null, true)
  }
}).fields(fileFields.map(f => ({name: f})))

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

const UserModel = mongoose.model('User', UserSchema)

// endpoints
router.get('/:username', async (req, res) => {
  const {username} = req.params
  const user = await UserModel.findOne({username})
  if(!user) return notFound(res)
  return res.status(200).json(user)
})

router.post('/:username',
  async (req, res) => {
    // first check if the user is modifying info of himself
    const { username } = req.params
    // additional check: besides logged in , he has to be the same user
    if (req.user.username !== username) {
      return unauthorized(res)
    }

    // parsing params
    const normalFields = _.differenceWith(optionalFields, fileFields, _.isEqual)

    // for each file, we append a field
    upload(req, res, async err => {
      if(err) return badRequest(res, err)
      // append the field
      const info = _.pick(req.body, normalFields)
      fileFields.forEach(f => {
        if(!req.files) return
        if(f in req.files) info[f] = `uploads/${username}/${f}`
      })
      // and update the rest of the models
      const result = await UserModel.findOneAndUpdate(
        {username}, info,
        { runValidators: true })

      return res.status(200).json(info)
    })

})

router.get('*', express.static(userUploadDir))
module.exports = {
  router,
  compulsoryFields,
  model: UserModel,
  schema: UserSchema
}
