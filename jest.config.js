module.exports = {
	preset: 'ts-jest',
	roots: ['<rootDir>/tests', '<rootDir>/src'],
	testEnvironment: 'node',
	collectCoverageFrom: ['src/**/*.{js,ts}'],
	coverageReporters: ['text'],
	moduleNameMapper: {
		'^bakeryjs': '<rootDir>/src',
	},
};
