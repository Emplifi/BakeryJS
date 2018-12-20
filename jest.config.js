const {pathsToModuleNameMapper} = require('ts-jest/utils');
const {readFileSync} = require('fs');
const JSON5 = require('json5');
const {compilerOptions} = JSON5.parse(readFileSync('tsconfig.json').toString());

module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	collectCoverageFrom: ['src/**/*.{js,ts}'],
	coverageReporters: ['text'],
	moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
		prefix: '<rootDir>/',
	}),
	testPathIgnorePatterns: ['<rootDir>/(build|docs|node_modules)/'],
};
