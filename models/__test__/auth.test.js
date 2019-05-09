const express = require("express")
const request = require("supertest")
const sinon = require("sinon")

const Mail = require("../../mail")

const { TokenModel } = require("../token")
const { model: UserModel } = require("../user")

const { router, authenticateMiddleware } = require("../auth")

const initApp = () => {
	const app = require("../../app")
	return app
}
// spies used accross all test suites in this file

describe("reset email", () => {
	let app
	// all spies involved in checking.

	const sendMailSpy = jest
		.spyOn(Mail, "sendResetPasswordEmail")
		.mockResolvedValueOnce({})

	const createEntrySpy = jest.spyOn(TokenModel, "createResetPasswordEntry")
	const findUserSpy = jest.spyOn(UserModel, "findOne")

	beforeEach(() => {
		app = initApp()

		// clear all spies.
		sendMailSpy.mockClear()
		createEntrySpy.mockClear()
		findUserSpy.mockClear()
	})

	// remove all fake implementations here
	afterAll(() => {
		jest.restoreAllMocks()
	})

	it("should send email with token", async () => {
		const mockedUser = {
			username: "whatever",
			email: "travisyttang@gmail.com"
		}
		const mockToken = "token"
		// prepare mock return value
		createEntrySpy.mockResolvedValueOnce(mockToken)
		findUserSpy.mockResolvedValueOnce(mockedUser)
		// trigger the endpoint.
		const response = await request(app)
			.post("/auth/resetPassword")
			.send({ email: mockedUser.email })
			.expect(200)
		// examine the spies after receiving the response

		// to result in all cases
		expect(response.body).toEqual({})
		expect(createEntrySpy).toBeCalledWith(mockedUser.email)
		expect(findUserSpy).toBeCalledWith({ email: mockedUser.email })
		expect(sendMailSpy).toBeCalledWith({
			account: mockedUser,
			token: mockToken
		})
	})

	it("Should not send email when user is not found", async () => {
		findUserSpy.mockResolvedValueOnce(null) // faking that there are not such user found.

		const response = await request(app)
			.post("/auth/resetPassword")
			.send({ email: "whatever" })
			.expect(200)

		// gives no hint to the user that thte user is not found.
		expect(response.body).toEqual({})
		// do not invoke these functions when users are not found.
		expect(createEntrySpy).not.toHaveBeenCalled()
		expect(sendMailSpy).not.toHaveBeenCalled()
	})
})

/**
	Test the actual update password procedure with an actual database.
*/
describe("set password", async () => {
	let app
	const mongoose = require("mongoose")
	const clearDatabase = () =>
		Promise.all([UserModel.remove({}), TokenModel.remove({})])

	const sendMailSpy = jest.spyOn(Mail, "sendResetPasswordEmail")
	const mockUser = {
		email: "test@gmail.com",
		username: "test",
		isPolitician: true,
		password: "password"
	}

	beforeAll(async () => {
		jest.setTimeout(20 * 1000) // lets give 20 seconds to the test since it is a long one.
		await mongoose.connect("mongodb://localhost:27027/test")
		// remove all relevant collections in case there is something left behind
		await clearDatabase()
	})

	afterAll(done => {
		jest.restoreAllMocks()
		mongoose.disconnect(done)
	})

	// before eacht request, register the fake user into the database
	beforeEach(async () => {
		app = initApp()
		// actually insert records to database
		await request(app)
			.post("/auth/register")
			.send(mockUser)
	})

	afterEach(async () => {
		await clearDatabase()
	})

	it("should actually update the password with the right token", async () => {
		/********************************
			Phase 1: create a fake account.
		********************************/
		console.log("Phase 1")
		const loginResponse = await request(app)
			.post("/auth/login")
			.send({ username: mockUser.username, password: mockUser.password })
			.expect(200)

		// first verify that the user can indeed be logged in with the mock credentials.
		expect(loginResponse.body).toMatchObject({
			token: expect.anything()
		})

		/********************************
			Phase 2: Trigger reset password request
		********************************/
		console.log("Phase 2")
		// to prevent emails actually being sent, spy on the email sending method.
		sendMailSpy.mockResolvedValueOnce({})
		// then lets say he forgets about his password...
		const resetResponse = await request(app)
			.post("/auth/resetPassword")
			.send({ email: mockUser.email })
			.expect(200)

		// nothing should be obtained.
		expect(resetResponse.body).toEqual({})

		/********************************
			Phase 3: Pretend to submit in the token as well as a new password
		********************************/
		console.log("Phase 3")
		// then lets cheat a bit: find out the token directly from database.
		const { token } = await TokenModel.findOne({ email: mockUser.email })
		// assert that the token entry is created
		expect(token).toBeTruthy()

		const newPassword = mockUser.password + "something new" // make sure that it really is different from the original password
		const payload = {
			email: mockUser.email,
			token,
			password: newPassword
		}

		const setPasswordResponse = await request(app)
			.post("/auth/setPassword")
			.send(payload)
			.expect(200)

		// check that the response from the set password request is appropriate
		expect(setPasswordResponse.body).toEqual({ updated: true })

		/********************************
			Phase 4: Verify that the password has really been updated
		********************************/
		console.log("Phase 4")
		const anotherLoginResponse = await request(app)
			.post("/auth/login")
			.send({ username: mockUser.username, password: mockUser.password })
			.expect(401) // unauthorized

		// verify that the old password does NOT work (so no token would return)
		expect(anotherLoginResponse.body).toEqual(
			expect.not.objectContaining({ token: expect.any(String) })
		)

		const finalLoginResponse = await request(app)
			.post("/auth/login")
			.send({ username: mockUser.username, password: newPassword })
			.expect(200)

		// and that the new password can indeed be used to login
		expect(finalLoginResponse.body).toEqual(
			expect.objectContaining({
				token: expect.any(String)
			})
		)
	})
})
