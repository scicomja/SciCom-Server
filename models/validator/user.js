const {
  isNumber,
  isInteger,
  isPositiveInteger,
  containsString,
  escapeForRegex
} = require('../../utils')
const {
  germanStates
} = require('../../constants')
const validateParameters = (query) => {
  const {
    name, title,
    major, position,
    state, city
  } = query

  if(state && !(state in germanStates)) {
    return false
  }
  return true // thats all for now
}

const addRegexTerm = (result, query, field) => {
  if(!(field in query)) return result
  return {
    ...result,
    [field]: {$regex: escapeForRegex(query[field])}
  }
}

const constructQuery = (query) => {
  const {
    name
  } = query

  let result = {}
  // regex term first
  result = "title,major,position,city".split(',')
    .reduce(
      (res, field) => addRegexTerm(res, query, field)
    , result)
  // special treatment on "name"
  if(name) {
    const regexOp = { $regex: escapeForRegex(name)}
    result['$or'] = [
      {"firstName": regexOp},
      {"lastName": regexOp},
      {"username": regexOp}
    ]
  }
  if('isPolitician' in query) {
    result.isPolitician = query.isPolitician
  }

  return result
}

module.exports = {
  validateParameters,
  constructQuery
}
