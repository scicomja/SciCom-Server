const express = require("express")
const request = require("supertest")
const sinon = require("sinon")

const Mail = require("../../mail")

const { TokenModel } = require("../token")
const { model: UserModel } = require("../user")
const { TEST_DATABASE_URL = "mongodb://localhost:27027/test" } = process.env

const { router, authenticateMiddleware } = require("../auth")

const Endpoints = {
	REGISTER: "/auth/register",
	LOGIN: "/auth/login",
	RESET_PASSWORD: "/auth/resetPassword",
	SET_PASSWORD: "/auth/setPassword"
}
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
			.post(Endpoints.RESET_PASSWORD)
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
			.post(Endpoints.RESET_PASSWORD)
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
		await mongoose.connect(TEST_DATABASE_URL)
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
			.post(Endpoints.REGISTER)
			.send(mockUser)
	})

	afterEach(async () => {
		await clearDatabase()
	})

	it("should actually update the password with the right token", async () => {
		/********************************
			Phase 1: create a fake account.
		********************************/
		const loginResponse = await request(app)
			.post(Endpoints.LOGIN)
			.send({ username: mockUser.username, password: mockUser.password })
			.expect(200)

		// first verify that the user can indeed be logged in with the mock credentials.
		expect(loginResponse.body).toMatchObject({
			token: expect.anything()
		})

		/********************************
			Phase 2: Trigger reset password request
		********************************/
		// to prevent emails actually being sent, spy on the email sending method.
		sendMailSpy.mockResolvedValueOnce({})
		// then lets say he forgets about his password...
		const resetResponse = await request(app)
			.post(Endpoints.RESET_PASSWORD)
			.send({ email: mockUser.email })
			.expect(200)

		// nothing should be obtained.
		expect(resetResponse.body).toEqual({})

		/********************************
			Phase 3: Pretend to submit in the token as well as a new password
		********************************/
		// then lets cheat a bit: find out the token directly from database.
		const resetPasswordTokenEntry = await TokenModel.findOne({
			email: mockUser.email
		})
		// assert that the token entry is created
		expect(resetPasswordTokenEntry).toBeTruthy()
		// check if the token created conforms to the type
		expect(resetPasswordTokenEntry).toEqual(
			expect.objectContaining({
				token: expect.any(String),
				email: expect.any(String),
				type: expect.any(String)
			})
		)
		// retrieve the token from the entry afterwards
		const token = resetPasswordTokenEntry.token

		const newPassword = mockUser.password + "something new" // make sure that it really is different from the original password
		const payload = {
			email: mockUser.email,
			token,
			password: newPassword
		}

		const setPasswordResponse = await request(app)
			.post(Endpoints.SET_PASSWORD)
			.send(payload)
			.expect(200)

		// check that the response from the set password request is appropriate
		expect(setPasswordResponse.body).toEqual({ updated: true })

		/********************************
			Phase 4: Verify that the password has really been updated
		********************************/
		// try logging in with the old password and it SHOULD FAIL (gives 401)
		const anotherLoginResponse = await request(app)
			.post(Endpoints.LOGIN)
			.send({ username: mockUser.username, password: mockUser.password })
			.expect(401) // unauthorized

		// verify that the old password does NOT work (so no token would return)
		expect(anotherLoginResponse.body).toEqual(
			expect.not.objectContaining({ token: expect.any(String) })
		)
		// verify that the new password SHOULD WORK (gives 200)
		const finalLoginResponse = await request(app)
			.post(Endpoints.LOGIN)
			.send({ username: mockUser.username, password: newPassword })
			.expect(200)

		// and that the token is returned
		expect(finalLoginResponse.body).toEqual(
			expect.objectContaining({
				token: expect.any(String)
			})
		)
	})

	it("should not update the password if token is invalid", async () => {
		// since the login has been checked by previous test, it is not checked here anymore.
		/********************************
			Phase 1: Trigger reset password request
		********************************/
		// to prevent emails actually being sent, spy on the email sending method.
		sendMailSpy.mockResolvedValueOnce({})
		// then lets say he forgets about his password...
		const resetResponse = await request(app)
			.post(Endpoints.RESET_PASSWORD)
			.send({ email: mockUser.email })
			.expect(200)

		// nothing should be obtained.
		expect(resetResponse.body).toEqual({})

		/********************************
			Phase 2: Use an invalid token to reset password
		********************************/
		const newPassword = mockUser.password + "new password"
		const setPasswordResponse = await request(app)
			.post(Endpoints.SET_PASSWORD)
			.send({
				email: mockUser.email,
				password: newPassword,
				token: "some_wrong_token"
			})
			.expect(200)

		expect(setPasswordResponse.body).toEqual({
			updated: false
		})

		/********************************
			Phase 3: Verify the user password has not be changed.
		********************************/
		const loginResponse = await request(app)
			.post(Endpoints.LOGIN)
			.send({
				username: mockUser.username,
				password: mockUser.password
			})
			.expect(200) // login should be successful

		const failedLoginResponse = await request(app)
			.post(Endpoints.LOGIN)
			.send({
				username: mockUser.username,
				password: newPassword
			})
			.expect(401) // this login should fail.
	})
})
