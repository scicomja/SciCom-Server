const mongoose = require('mongoose')
const express = require('express')
const bcrypt = require('bcrypt')

const _ = require('lodash')

const multer  = require('multer')
const fs = require('fs')
const path = require('path')
const {
  badRequest,
  escapeForRegex
} = require('../utils')

const {
  validateParameters,
  constructQuery
} = require('./validator/user')

const {
  unauthorized, notFound
} = require('../utils')
const { userUploadDir } = require('../constants')

const { model: ApplicationModel } = require('./application')
const { model: ProjectModel } = require('./project')

const storage = multer.diskStorage({
  destination: function (req, file, cb) {

    const dir = `uploads/${req.user.username}`
    // create this directory if not exist
    if(!fs.existsSync(userUploadDir)) {
      fs.mkdirSync(userUploadDir)
    }
    if(!fs.existsSync(dir)) {
      fs.mkdirSync(dir)
    }
    cb(null, dir)
  },

  filename: function (req, file, cb) {
    let fileName = file.fieldname
    // if what is uploading isn't CV, then just strip out the suffix...
    if (fileName == 'CV') {
      fileName = `${file.fieldname}.${_.last(file.mimetype.split('/'))}`
    }
    cb(null, fileName)
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
  firstName: String,
  lastName: String,

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
  },
  bookmarks: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      autopopulate: true
    }
  ]
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
  .plugin(require('mongoose-autopopulate'))

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

UserSchema.pre('remove', async function(next) {
  console.log('pre remove user hook', this)
  const { bookmarks = [], _id, isPolitician } = this
  if(isPolitician) {
    const removeProjects = await ProjetModel.find({ creator: _id }).remove()
  } else {
    const applications = await ApplicationModel.find({
      applicant: _id
    }).remove()
  }
  next()
})

const UserModel = mongoose.model('User', UserSchema)

// endpoints
/*
  Search user
  For now the searches are restricted to name search
  means only the "name" field will be considered
*/
router.get('/', async (req, res) => {
  const fields = "name,title,isPolitician,position,state,city,major".split(',')
  const query = _.pick(req.query, fields)

  if(_.isEmpty(query)) {
    return res.status(200).json(req.user)
  }

  if(!validateParameters(query)) {
    return badRequest(res, {message: "invalid query"})
  }

  const finalQuery = constructQuery(query)
  // return the user itself if no parameters are given
  const { page = 1 } = req.query
  const limit = 10

  const numUsers = await UserModel.find(finalQuery).count()
  const numPages = Math.floor(numUsers / limit)
  const results = await UserModel.find(finalQuery)
    .sort('name')
    .skip((parseInt(page) - 1) * limit)
    .limit(limit)

  return res.status(200).json({ results, total: numPages})
})

// info for particular users
router.get('/:username', async (req, res) => {
  const {username} = req.params
  const user = await UserModel.findOne({username})
  if(!user) return notFound(res)
  return res.status(200).json(user)
})

router.delete('/',
  async (req, res) => {
    const { username, _id, isPolitician } = req.user
    try {
      const deleteResult = await UserModel.findOneAndDelete({ username })
      return res.json({ status: 'removed' })
    } catch(err) {
      return badRequest(res, "failed to remove user")
    }
    return res.json({ 'status': 'deleted'})
  }
)
/*
  Update user info
*/
router.post('/',
  async (req, res) => {
    // get the username of this guy
    const { isPolitician, username } = req.user

    // parsing params
    let updatableFields = "firstName,lastName,phone,website,linkedIn,city,state,title".split(',')
    // additional fields according to the user's role
    if(isPolitician) {
    	updatableFields = updatableFields.concat(["position"])
    } else {
    	updatableFields = updatableFields.concat("major,university".split(','))
    }
    // for each file, we append a field
    upload(req, res, async err => {
      if(err) return badRequest(res, err)
      // append the field
      let info = _.pick(req.body, updatableFields)
      fileFields.forEach(f => {
        if(!req.files) return
        if(f in req.files) info[f] = `${username}/${f}`
      })
      // special treatment for "major" since it is an array
      if("major" in info) {
        // turn the "major" field to an array if it is not...
        if(!_.isArray(info.major)) {
          info.major = [info.major]
        }
        // info.major = info.major.split(',')
      } else {
        info.major = []
      }

      // and update the rest of the models
      const result = await UserModel.findOneAndUpdate(
        {username}, { $set: info },
        { runValidators: true })
      return res.status(200).json(info)
    })

})
/*
  Get Project of users.
  - if given username is a politician, return the projects he works on.
  - if given username is a student, return the applications he is working on
*/
router.get('/:username/projects', async (req,res) => {
  const { username } = req.params
  const user = await UserModel.findOne({username})
  if(!user) return notFound(res)
  const {isPolitician} = user
  if(isPolitician) {
    let projects = await ProjectModel.find({creator: user._id})
    return res.status(200).json(projects)
  } else {
    let projects = await ApplicationModel.find({
      applicant: user._id, status: "accepted"
    })
    return res.status(200).json(projects)
  }
})

// force the mimetype to be image since this is an avatar
router.get('/:username/avatar', async (req, res) => {
  const filePath = path.resolve(
    userUploadDir,
    `${req.params.username}`, 'avatar')
  fs.readFile(filePath, (err, data) => {
    if(err) return notFound(res)
    res.contentType('image/png')
    res.send(data)
  })
})

router.get('*', express.static(userUploadDir))
module.exports = {
  router,
  compulsoryFields,
  model: UserModel,
  schema: UserSchema
}
