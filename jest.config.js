module.exports = {
	roots: ['<rootDir>/tests', '<rootDir>/src'],
	testEnvironment: 'node',
	collectCoverageFrom: ['src/**/*.{js,ts}'],
	coverageReporters: ['html', 'text'],
	testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(tsx?|js)?$',
	transform: {
		'^.+\\.tsx?$': 'ts-jest',
	},
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
