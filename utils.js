
// 403
const unauthorized = (res, message = null) => res.status(403).json({error: "Unauthorized", message})
// 404
const notFound = (res) => res.status(404).json({error: "Resource not found"})
// 400
const badRequest = (res, err) => res.status(400).json({error: "bad request", ...err})

const randomString = (len = 24, base = 32) => {
  let res = ''
  while (res.length < len) {
    res += Math.random().toString(base).substring(2)
  }
  return res.substring(0, len)
}

const generateID = async (model) => {
  const ObjectId = require('mongoose').Types.ObjectId
  while(true) {
    const str = randomString(24, 16)
    const id = ObjectId(str)
    const duplicate = await model.findOne({_id: id})
    if(!duplicate) return id
  }
}
module.exports = {
  unauthorized,
  notFound,
  badRequest,

  randomString,
  generateID
}
