const mongoose = require('mongoose')
const express = require('express')
const bcrypt = require('bcrypt')
const passport = require('passport')
const router = express.Router()
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, select: false, required: true },
  isPolitician: {type: Boolean, required: true, default: false}
})

UserSchema.pre('save', function(next) {
    var user = this
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

UserSchema.methods.comparePassword = function(candidatePassword, cb) {
    return new Promise(
      (resolve, _) => bcrypt.compare(
        candidatePassword, this.password,
        (err, isMatch) => resolve({err, isMatch}))
    )
}
const UserModel = mongoose.model('User',UserSchema)

const unauthorized = (res) => res.status(403).json({error: "Unauthorized"})
const notFound = (res) => res.status(404).json({error: "Resource not found"})
router.use(passport.authenticate('jwt', {session: false}))
router.get('/:username', async (req, res) => {
  if(!req.user) return unauthorized(res)
  const {username} = req.params
  const user = await UserModel.findOne({username})
  if(!user) return notFound(res)
  return res.status(200).json(user)
})


module.exports = {
  router,
  model: UserModel,
  schema: UserSchema
}
