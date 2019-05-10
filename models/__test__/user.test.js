const request = require("supertest")
const mongoose = require("mongoose")
const app = require("../../app")
const Mail = require("../../mail")
const { TEST_DATABASE_URL = "mongodb://localhost:27027/test" } = process.env
const { model: UserModel } = require("../user")
const { TokenModel } = require("../token")

// some endpoint definitions
const Endpoints = {
	REGISTER: "/auth/register",
	LOGIN: "/auth/login"
}

// mock credentials
const mockUser = {
	email: "whatever@example.com",
	password: "whatever",
	isPolitician: true,
	username: "whatever"
}

// stop the code from really sending emails to outside
const sendEmailSpy = jest
	.spyOn(Mail, "sendVerificationEmail")
	.mockResolvedValue({})

describe("User login", async () => {
	it("should give the user a token on successful login", async () => {
		await request(app)
			.post(Endpoints.REGISTER)
			.send(mockUser)

		const loginResponse = await request(app)
			.post(Endpoints.LOGIN)
			.send({ username: mockUser.username, password: mockUser.password })
			.expect(200)

		// if login is successful, it should deliver a token back
		expect(loginResponse.body).toEqual(
			expect.objectContaining({
				token: expect.any(String)
			})
		)
	})
})
describe("User registration", async () => {
	beforeEach(async () => {
		await request(app)
			.post(Endpoints.REGISTER)
			.send(mockUser)
	})

	it("should send the verification email during registration", async () => {
		const { token } = await TokenModel.findOne({ email: mockUser.email })
		// the token from the record should be a string.
		expect(token).toEqual(expect.any(String))

		expect(sendEmailSpy).toHaveBeenCalledWith({
			email: mockUser.email,
			verificationToken: token
		})
	})

	it("should create an entry in database after registration", async () => {
		// new credential from the main one to test the whole flow
		const credential = {
			username: "another mock user",
			password: "password",
			isPolitician: true,
			email: "another.mock@example.com"
		}

		const registrationResponse = await request(app)
			.post(Endpoints.REGISTER)
			.send(credential)
			.expect(200)

		// assure that no token issued to the user prior to verification
		expect(registrationResponse.body).not.toHaveProperty("token")

		// try to find out the entry
		const user = await UserModel.findOne({ username: credential.username })
		// there should be such record
		expect(user).toBeTruthy()
		// and he should be unverified
		expect(user.verified).toBe(false)
	})

	it("should not create an entry in database if there are users having the same username or the same email", async () => {
		// try to register another person with the same user name
		const sameUsernameRegResponse = await request(app)
			.post(Endpoints.REGISTER)
			.send({
				...mockUser,
				email: "fake@example.com"
			})
			.expect(400) // that should be an abnormal status code instead of a simple 200.

		expect(sameUsernameRegResponse.body).toEqual(
			expect.objectContaining({
				error: expect.any(String)
			})
		)

		// and there should not have more than one records of this mock user
		const users = await UserModel.find({ username: mockUser.username })
		expect(users.length).toBe(1)

		// now try to register another person with the same email.
		const sameEmailRegResponse = await request(app)
			.post(Endpoints.REGISTER)
			.send({
				...mockUser,
				username: "fakeUser"
			})
			.expect(400)

		// again there should only be one record for this mock user
		const usersAgain = await UserModel.find({ username: mockUser.username })
		expect(usersAgain.length).toBe(1)
	})
})

describe("user verification", async () => {
	// helper function
	const clearDatabase = () =>
		Promise.all([UserModel.remove({}), TokenModel.remove({})])

	beforeAll(async () => {
		mongoose.connect(TEST_DATABASE_URL)
		await clearDatabase()
	})

	beforeEach(async () => {
		// register the mock user.
		await request(app)
			.post(Endpoints.REGISTER)
			.send(mockUser)
	})

	afterEach(async () => {
		await clearDatabase()
	})

	afterAll(async () => {
		mongoose.disconnect()
	})

	it("should mark the user as unverified after registration", async () => {
		const user = await UserModel.findOne({ username: mockUser.username })

		// verify that there is such a user
		expect(user).toEqual(
			expect.objectContaining({
				username: mockUser.username,
				email: mockUser.email
			})
		)
		// verify that the user is unverified.
		expect(user.verified).toBe(false)
	})

	it("should be able to mark the user as verified form User's static method", async () => {
		// verify the user by it's email
		await UserModel.verifyUser(mockUser.email)

		const user = await UserModel.findOne({ username: mockUser.username })

		expect(user.verified).toBe(true)
	})
})
