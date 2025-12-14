/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	collectCoverageFrom: ['src/**/*.{js,ts}'],
	coverageReporters: ['text', 'lcov'],
	moduleNameMapper: {
		'^bakeryjs$': '<rootDir>/src/index.ts',
		'^bakeryjs/(.*)$': '<rootDir>/src/lib/bakeryjs/$1',
	},
	testPathIgnorePatterns: ['<rootDir>/(build|docs|node_modules)/'],
	setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
	transform: {
		'^.+\\.tsx?$': [
			'ts-jest',
			{
				tsconfig: 'tsconfig.json',
			},
		],
	},
};
