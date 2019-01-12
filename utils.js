const unauthorized = (res) => res.status(403).json({error: "Unauthorized"})
const notFound = (res) => res.status(404).json({error: "Resource not found"})

module.exports = {
  unauthorized, notFound
}
