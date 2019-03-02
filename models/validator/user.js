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
  if(state && germanStates.indexOf(state) == -1) {
    return false
  }
  return true // thats all for now
}

const addRegexTerm = (result, query, field) => {
  if(!(field in query)) return result
  return {
    ...result,
    [field]: {$regex: escapeForRegex(query[field]), $options: 'i'}
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

  // exact search term for 'state'
  if('state' in query) {
    result.state = query.state
  }

  return result
}

module.exports = {
  validateParameters,
  constructQuery
}
