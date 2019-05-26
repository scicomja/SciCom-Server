const mongoose = require("mongoose")

const { model: ProjectModel } = require("../project")
const { TEST_DATABASE_URL = "mongodb://localhost:27027/test" } = process.env

beforeAll(async () => {
	mongoose.connect(TEST_DATABASE_URL)
	await ProjectModel.remove({})
})

afterAll(done => {
	mongoose.disconnect(done)
})

afterEach(async () => {
	await ProjectModel.remove({})
})

it("should query project correctly", async () => {
	const mockProjects = [
		{
			title: "whatever title",
			description: "description",
			tags: ["tag1", "tag2", "tag3"],
			salary: 100,
			creator: mongoose.Types.ObjectId() // a newly created object Id to suppress relevant errors
		},
		{
			title: "another title",
			description: "another",
			tags: ["ttt"],
			salary: 1000,
			creator: mongoose.Types.ObjectId()
		}
	]

	// populate the database
	await ProjectModel.insertMany(mockProjects)
	// check that there are just this many documents only
	expect(await ProjectModel.count({})).toBe(mockProjects.length)

	/**
    Name-only query
  */
	const nameQueries = "what,WHAT,title,TI,XX"
		.split(",")
		.map(query => ({ searchTerm: query }))

	const nameResults = await Promise.all(
		nameQueries.map(query => ProjectModel.queryProject(query))
	)

	expect(nameResults.map(res => res.length)).toEqual([1, 1, 2, 2, 0])

	/**
    searchTerm with salary
  */
	const nameSalaryQuery = [
		{
			searchTerm: "ever",
			salary: 10
		},
		{
			searchTerm: "ever",
			salary: 100
		},
		{
			searchTerm: "title",
			salary: 100
		},
		{
			searchTerm: "ther",
			salary: 10000
		}
	]
	const nameSalaryQueryResults = await Promise.all(
		nameSalaryQuery.map(query => ProjectModel.queryProject(query))
	)

	expect(nameSalaryQueryResults.map(res => res.length)).toEqual([0, 1, 2, 0])
})
