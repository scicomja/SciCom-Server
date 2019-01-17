
const express = require('express')
const morgan = require('morgan')
const mongoose = require('mongoose')
const bodyParser = require('body-parser')
const {
  router: userRouter,
} = require('./models/user')

const {
  authenticateMiddleware,
  router: authRouter
} = require('./models/auth')

const {
  router: projectRouter
} = require('./models/project')

const {
  router: applicationRouter
} = require('./models/application')

const {
 notFound
} = require('./utils')

const DATABASE_URL = process.env.database_url || 'localhost'
const DATABASE_PORT = process.env.database_port || 27017
const DATABASE_NAME = process.env.database_name || 'scicom'
// connect to database
mongoose.connect(`mongodb://${DATABASE_URL}:${DATABASE_PORT}/${DATABASE_NAME}`)

app = express()
// logging middleware
app.use(morgan('combined'))
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

// endpoints
app.use('/auth', authRouter)
app.use('/user', authenticateMiddleware, userRouter)
app.use('/project', authenticateMiddleware, projectRouter)
app.use('/application', authenticateMiddleware, applicationRouter)
// general 404 error
app.use('*', (req,res) => notFound(res))

// launch app
app.listen(3000, () => console.log('server listening on port 3000'))
