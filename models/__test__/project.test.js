const mongoose = require("mongoose")
const request = require("supertest")
const app = require("../../app")
const { model: ProjectModel } = require("../project")
const { model: UserModel } = require("../user")

const { TEST_DATABASE_URL = "mongodb://localhost:27027/test" } = process.env
const _ = require("lodash")

beforeAll(async () => {
	mongoose.connect(TEST_DATABASE_URL)
	await ProjectModel.remove({})
	await UserModel.remove({})
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
			salary: 10 // less than
		},
		{
			searchTerm: "ever",
			salary: 100 // eq. case
		},
		{
			searchTerm: "title",
			salary: 100 // multiple gte.
		},
		{
			searchTerm: "ther",
			salary: 10000 // greater than
		}
	]
	const nameSalaryQueryResults = await Promise.all(
		nameSalaryQuery.map(query => ProjectModel.queryProject(query))
	)

	expect(nameSalaryQueryResults.map(res => res.length)).toEqual([1, 1, 2, 0])
})

it("should be able to query projects through GET /", async () => {
	// first create a user
	const user = await UserModel.create({
		isPolitician: true,
		username: "test_poli",
		password: "poli",
		email: "polipoli@example.com"
	})

	const creatorID = user._id

	const mockProjects = {
		title: "whatever title",
		description: "description",
		tags: ["tag1", "tag2", "tag3"],
		salary: 100,
		creator: user
	}

	const project = await ProjectModel.create(mockProjects)

	const projectID = project._id

	// login...
	const loginResponse = await request(app)
		.post("/auth/login")
		.send(_.pick(user, "username,password".split(",")))
		.expect(200)

	console.log("login response", loginResponse)
	const queryResponse = await request(app)
		.get("/project/")
		.set("Authorization", `Bearer ${loginResponse.token}`)
		.expect(200)
})
