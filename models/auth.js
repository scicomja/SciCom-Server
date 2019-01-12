const mongoose = require('mongoose')
const express = require('express')

// configure authentication
const passport = require('passport')
const passportJWT = require("passport-jwt");
const JWTStrategy   = passportJWT.Strategy;
const ExtractJWT = passportJWT.ExtractJwt

const {
  model: UserModel
} = require('./user')
const jwt = require("jsonwebtoken")
const ExtractJwt = require('passport-jwt').ExtractJwt
const SECRET = process.env.secret || "SOME SECRET"
// configure authentication strategy
passport.use(new JWTStrategy({
        jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
        secretOrKey   : SECRET
    },
    ({username}, cb) => {
        //find the user in db if needed. This functionality may be omitted if you store everything you'll need in JWT payload.
        return UserModel.findOne({ username })
            .then(user => {
                return cb(null, user);
            })
            .catch(err => {
                return cb(err);
            });
    }
))

const router = express.Router()
const compulsoryFields = 'username,email,password,isPolitician'.split(',')

const signUser = (username) => jwt.sign({ username }, SECRET, {})

router.post('/register', async (req, res) => {
  const info = req.body
  if(!info) {
    return res.status(400).json({
      error: "missing post data"
    })
  }
  // check compulsory fields
  if(compulsoryFields.some(f => !(f in info))) {
    return res.status(400).json({
      error: "missing one of username, email or password fields"
    })
  }
  const {username, email, password, isPolitician} = info
  // check if user exists
  const existUsers = await UserModel.find({
    $or: [
      {username},
      {email}
    ]
  })
  if(existUsers.length > 0) {
    return res.status(400).json({
      error: "user with email or username exists"
    })
  }
  const token = signUser(username)
  const result = await UserModel.create({
    username,
    email,
    password,
    isPolitician
  })
  console.log(result)
  return res.status(201).json({
    token
  })
})

router.post('/login', async (req, res) => {
  const info = req.body
  const invalidate = () => res.status(401).json({
    error: "Invalid username / password"
  })

  if(!info) {
    return res.status(400).json({
      error: "missing post data"
    })
  }
  const { username, password } = info
  const user = await UserModel.findOne({
    username
  })
  if(!user) return invalidate()
  const {err, isMatch} = await user.comparePassword(password)
  if(err || !isMatch) return invalidate()
  const token = signUser(username)
  return res.status(200).json({token})
})
module.exports = {router}
