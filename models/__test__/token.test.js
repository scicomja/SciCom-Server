const mongoose = require("mongoose")
const { TokenModel, tokenType } = require("../token")
const { TEST_DATABASE_URL = "mongodb://localhost:27027/test" } = process.env

// test data
const mockEmail = "whatever"

// use a real mongodb that got reset everytime.
beforeAll(async () => {
	mongoose.connect(TEST_DATABASE_URL)
	await TokenModel.remove({})
})

afterAll(done => {
	mongoose.disconnect(done)
})

// empty the database once the test is completed
afterEach(async () => {
	await TokenModel.remove({})
})

it("should create an entry from `createResetPasswordEntry`", async () => {
	const token = await TokenModel.createResetPasswordEntry(mockEmail)

	expect(typeof token).toBe("string")

	// there should be only one matching object in the database
	const tokenObjects = await TokenModel.find({ email: mockEmail })
	expect(tokenObjects.length).toBe(1)

	// and the object should have the following field
	const firstResult = tokenObjects[0]
	const expectedPayload = {
		type: tokenType.RESET_PASSWORD,
		email: mockEmail,
		token
	}
	expect(firstResult).toEqual(expect.objectContaining(expectedPayload))
})

it("should update the existing entry when `createResetPasswordEntry` is called more than once", async () => {
	const firstToken = await TokenModel.createResetPasswordEntry(mockEmail)
	const secondToken = await TokenModel.createResetPasswordEntry(mockEmail)

	// the two tokens should not be the same
	expect(firstToken).not.toEqual(secondToken)

	// there should only be 1 entry regarind this email in the database
	const tokenObjects = await TokenModel.find({ email: mockEmail })
	expect(tokenObjects.length).toBe(1)

	// and this entry should contain the second token only
	const firstResult = tokenObjects[0]
	const expectedPayload = {
		type: tokenType.RESET_PASSWORD,
		email: mockEmail,
		token: secondToken // the updated token
	}
	expect(firstResult).toEqual(expect.objectContaining(expectedPayload))
})
describe("matching token", () => {
	/**
    Steps for testing `matchToken` method in TokenModel:
      - create a token entry from reset email request.
      - invoke the `matchToken` method.
      - check:
        = if token is removed.
        = if result is true
  */

	it("should remove matching token", async () => {
		// 1.
		const token = await TokenModel.createResetPasswordEntry(mockEmail)

		const matchTokenPayload = {
			email: mockEmail,
			token,
			type: tokenType.RESET_PASSWORD
		}
		// 2.
		const isMatch = await TokenModel.matchToken(matchTokenPayload)

		const tokenObjects = await TokenModel.find({ mockEmail })
		// 3.
		expect(tokenObjects.length).toBe(0)
		expect(isMatch).toBe(true)
	})

	it("should not remove non-matching token", async () => {
		const token = await TokenModel.createResetPasswordEntry(mockEmail)
		const matchTokenPayload = {
			email: mockEmail,
			token: "wrong-token",
			type: tokenType.RESET_PASSWORD
		}
		// verify that it returns false
		const isMatch = await TokenModel.matchToken(matchTokenPayload)
		expect(isMatch).toBe(false)
		// verify that no docs are removed
		const numDocs = await TokenModel.count({})
		expect(numDocs).toBe(1)
	})

	it("should not remove irrelevant record if the payload is malformed", async () => {
		const otherRecords = [
			// records with same type but different email.
			{
				email: "email1",
				type: tokenType.RESET_PASSWORD,
				token: "token"
			},
			// records with different type
			{
				email: "email2",
				type: tokenType.EMAIL_VERIFICATION,
				token: "token2"
			},
			// records with same type and same email but different token.
			{
				email: "email3",
				type: tokenType.RESET_PASSWORD,
				token: "token"
			}
		]

		// add all records to database.
		await TokenModel.insertMany(otherRecords)

		// verify there are exactly that many records in the database
		const numInserted = await TokenModel.count({})
		expect(numInserted).toBe(otherRecords.length)

		// malformed cases that misses one or more payload
		const testPayloads = [
			{ email: "email1" },
			{ email: "email1", token: "token" },
			{ email: "email1", type: tokenType.RESET_PASSWORD },
			{ token: "token" },
			{ token: "token", type: tokenType.RESET_PASSWORD },
			{ type: tokenType.RESET_PASSWORD },
			{}
		]

		await Promise.all(
			testPayloads.map(async payload => {
				const res = await TokenModel.matchToken(payload)
				expect(res).toBe(false)

				const numDocs = await TokenModel.count({})
				expect(numDocs).toBe(otherRecords.length)
			})
		)
	})
})

describe("Create email verification token", async () => {
	it("should create a email verification token", async () => {
		const token = TokenModel.createEmailVerificationEntry(mockEmail)

		const entry = TokenModel.findOne({
			token,
			email: mockEmail
		})

		expect(entry).toBeTruthy()
	})
})
