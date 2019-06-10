const germanStates = [
  "Bayern",
  "Berlin",
  "Niedersachsen",
  "Baden-Württemberg",
  "Rheinland-Pfalz",
  "Sachsen",
  "Thüringen",
  "Hessen",
  "Nordrhein-Westfalen",
  "Sachsen-Anhalt",
  "Brandenburg",
  "Mecklenburg-Vorpommern",
  "Hamburg",
  "Schleswig-Holstein",
  "Saarland",
  "Bremen"
]

const projectStatus = [
  "open",
  "active",
  "completed",
  "closed",
  "deleted"
]

const projectType = [
  'internship',
  'thesis',
  'parttime',
  'voluntary',
  'quick-question'
]
const applicationStatus = [
  "pending",
  "accepted",
  "rejected"
]

const projectDir = 'projects/'
const userUploadDir = 'uploads/'
module.exports = {
  germanStates,
  projectStatus,
  projectType,
  projectDir,
  userUploadDir,
  applicationStatus

}
