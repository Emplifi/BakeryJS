/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	collectCoverageFrom: ['src/**/*.{js,ts}', '!src/**/*.d.ts'],
	coverageDirectory: 'coverage',
	coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json'],
	coverageThreshold: {
		global: {
			branches: 50,
			functions: 50,
			lines: 50,
			statements: 50,
		},
	},
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
