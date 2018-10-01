module.exports = {
	preset: 'ts-jest',
	roots: ['<rootDir>/tests', '<rootDir>/src'],
	testEnvironment: 'node',
	collectCoverageFrom: ['src/**/*.{js,ts}'],
	coverageReporters: ['html', 'text'],
	moduleNameMapper: {
		'^bakeryjs': '<rootDir>/src',
	},
};
