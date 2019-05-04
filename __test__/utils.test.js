describe("containsString", () => {
	const { containsString } = require("../utils")

	const sampleString = "abcdefghijkl"

	it("should detect substring", () => {
		const subString = "def"
		// detects substring in case-sensitive mode
		expect(containsString(sampleString, subString)).toBe(true)
		expect(containsString(sampleString, subString.toUpperCase())).toBe(true)
	})

	it("should detect substring at the beginning of the string", () => {
		const subString = "abc"
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

	it("should tell a number as a number", () => {
		const number = "10"
		expect(isNumber(number)).toBe(true)
		expect(isInteger(number)).toBe(true)
		expect(isPositiveInteger(number)).toBe(true)
	})

	it("shoul test a float apart", () => {
		const number = "3.14"
		expect(isNumber(number)).toBe(true)
		expect(isInteger(number)).toBe(false)
		expect(isPositiveInteger(number)).toBe(false)
	})
})
