const {
  isNumber,
  isInteger,
  isPositiveInteger,
  containsString,
  escapeForRegex
} = require('../../utils')

// validate incoming parameters
const validateParameters = (query) => {
  const {
    title,status,nature,salary,from,page
  } = query

  // check "from" date
  if(from && !isNumber(new Date(from).getTime())) {
    return false
  }
  if(page && !isPositiveInteger(page)) {
    return false
  }
  if(salary && !isNumber(salary)) {
    return false
  }
  return true // so far so good
}
const addRegexTerm = (result, query, field) => {
  if(!(field in query)) return result
  return {
    ...result,
    [field]: {$regex: escapeForRegex(query[field])}
  }
}

const addExactTerm = (result, query, field) => {
  if(!(field in query)) return result
  return {
    ...result,
    [field]: query[field]
  }
}
// return mongoose-recognizable queries
const constructQuery = (query) => {
  const {
    title,status,nature,salary,from
  } = query

  let result = {}
  // add all regex term...
  result = "title,topic".split(',').reduce(
    (res, field) => addRegexTerm(res,query, field),
    result)

  // add all exact term
  result = "status,nature".split(',').reduce(
    (res, field) => addExactTerm(res, query, field),
    result)

  // if(title) {
  //   result["title"] = {
  //     "$regex": escapeForRegex(title)
  //   }
  // }
  // if(status) {
  //   result["status"] = status
  // }
  // if(nature) {
  //   result["nature"] = nature
  // }
  if(salary) {
    result["salary"] = {$gte: parseFloat(salary)}
  }
  if(from) {
    result["from"] = {$gte: new Date(from)}
  }

  return result
}

module.exports = {
  validateParameters,
  constructQuery
}
