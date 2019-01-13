// 403
const unauthorized = (res) => res.status(403).json({error: "Unauthorized"})
// 404
const notFound = (res) => res.status(404).json({error: "Resource not found"})
// 400
const badRequest = (res, err) => res.status(403).json({error: "bad request", ...err})

module.exports = {
  unauthorized,
  notFound,
  badRequest
}
