describe("containsString", () => {
	const { containsString } = require("../utils")

	const sampleString = "abcdefghijkl"

	it("should detect substring", () => {
		const subString = "def"
		// detects substring in case-sensitive mode
		expect(containsString(sampleString, subString)).toBe(true)
		expect(containsString(sampleString, subString.toUpperCase())).toBe(true)
	})

	it("should take case sensitive flag into account", () => {
		const subString = "dEF"

		// detects substring in case-sensitive mode
		expect(containsString(sampleString, subString, true)).toBe(false)
	})
})

describe("randomString", () => {
	const { randomString } = require("../utils")

	it("should generate strings with specified length", () => {
		const len = 10
		// try 100 times
		for (let i = 0; i < 100; i++) {
			const str = randomString(len)
			expect(str.length).toBe(len)
		}
	})

	it("should generate string with characters within some ranges", () => {
		const len = 10
		const base = 10

		for (let i = 0; i < 100; i++) {
			const str = randomString(len, base)
			expect(isNaN(str)).toBe(false)
		}
	})
})

describe("number misc.", () => {
	const { isNumber, isInteger, isPositiveInteger } = require("../utils")
	const testSuite = (number, ans1, ans2, ans3) => {
		expect(isNumber(number)).toBe(ans1)
		expect(isInteger(number)).toBe(ans2)
		expect(isPositiveInteger(number)).toBe(ans3)
	}
	it("should tell a number as a number", () => {
		const number = "10"
		return testSuite(number, true, true, true)
	})

	it("shoul test a float apart", () => {
		const number = "3.14"
		return testSuite(number, true, false, false)
	})
})
