const express = require("express")
const request = require("supertest")
const sinon = require("sinon")
const User = require("../user")
const { router, authenticateMiddleware } = require("../auth")

const initApp = () => {
	const app = express()
	app.use(require("body-parser"))
	app.use("/auth", router)

	return app
}

describe("reset email", () => {
	let app

	beforeEach(() => {
		app = initApp()
	})

	it("should send email with token", done => {
		const mockedUser = {
			username: "whatever",
			email: "travisyttang@gmail.com"
		}
		const mockFindOneUser = jest.fn().mockResolvedValueOnce(mockedUser)
		jest.mock("../user", () => {
			return {
				UserModel: {
					findOne: mockFindOneUser
				}
			}
		})
		// trigger the endpoint.
		request(app)
			.post("/auth/resetPassword")
			.send({ email: mockedUser.email })
			.expect(200)
			.end((err, res) => {
				expect(mockFindOneUser).not.toBeCalledWith({ email: mockedUser.email })
				expect(sendMailSpy).toBeCalledWith({
					account: mockedUser,
					token: expect.anything()
				})
				done()
			})
	})
})
