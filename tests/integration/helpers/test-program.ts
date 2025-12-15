import { Program } from 'bakeryjs'

export interface TestProgramOptions {
	componentPaths?: string[]
	services?: Record<string, unknown>
}

/**
 * Creates a Program instance configured for integration testing.
 * By default, includes both the integration test components and the test-data components.
 */
export function createTestProgram(options: TestProgramOptions = {}): Program {
	return new Program(options.services ?? {}, {
		componentPaths: options.componentPaths ?? [
			`${__dirname}/../components/`,
			`${__dirname}/../../../test-data/`
		]
	})
}
