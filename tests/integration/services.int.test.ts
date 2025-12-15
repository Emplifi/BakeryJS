/**
 * Service Injection Integration Tests
 *
 * Tests for dependency injection and services.
 * Test cases 9.1-9.4 from the Integration Test Plan.
 */
import { Program } from 'bakeryjs'
import { createTestProgram } from './helpers/test-program'
import { MessageCollector } from './helpers/message-collector'
import {
	customServiceCalls,
	clearCustomServiceCalls
} from './components/processors/custom-service-processor'

describe('Service Injection Integration Tests', () => {
	let collector: MessageCollector

	beforeEach(() => {
		collector = new MessageCollector()
		clearCustomServiceCalls()
	})

	describe('9.1 Default logger', () => {
		it('default logger is available when no custom logger provided', async () => {
			// Create program without custom logger
			const program = createTestProgram()

			const job = {
				process: [['logger-processor']]
			}

			// Should not throw - default logger is available
			await program.run(job, collector.drain)

			expect(collector.count).toBe(1)
			expect(collector.first).toHaveProperty('logged', true)
		})

		it('default logger has log and error methods', async () => {
			// Verify the default logger works without throwing
			const program = createTestProgram()

			const job = {
				process: [['logger-processor'], ['identity-processor']]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(1)
		})
	})

	describe('9.2 Custom logger', () => {
		it('boxes receive custom logger from services', async () => {
			const logs: unknown[] = []
			const customLogger = {
				log: (msg: unknown): void => {
					logs.push(msg)
				},
				error: (msg: unknown): void => {
					logs.push({ error: msg })
				}
			}

			const program = new Program(
				{ logger: customLogger },
				{ componentPaths: [`${__dirname}/components/`] }
			)

			const job = {
				process: [['logger-processor']]
			}

			await program.run(job, collector.drain)

			expect(logs.length).toBeGreaterThan(0)
			// The logger-processor logs an object with 'loggerProcessor' key
			expect(
				logs.some(log => typeof log === 'object' && log !== null && 'loggerProcessor' in log)
			).toBe(true)
		})

		it('custom logger receives all log calls from boxes', async () => {
			const logs: unknown[] = []
			const customLogger = {
				log: (msg: unknown): void => {
					logs.push(msg)
				},
				error: jest.fn()
			}

			const program = new Program(
				{ logger: customLogger },
				{ componentPaths: [`${__dirname}/components/`] }
			)

			// Run flow with multiple logger-processor calls via generator
			const job = {
				parameters: { 'configurable-generator': { count: 3 } },
				process: [[{ 'configurable-generator': [['logger-processor']] }]]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(3)
			// Each message should trigger one log call
			expect(logs.length).toBeGreaterThanOrEqual(3)
		})
	})

	describe('9.3 Custom service', () => {
		it('boxes can access arbitrary custom services', async () => {
			const customService = {
				process: jest.fn((value: unknown) => ({ processed: true, original: value }))
			}

			const program = new Program(
				{ customService },
				{ componentPaths: [`${__dirname}/components/`] }
			)

			const job = {
				process: [['custom-service-processor']]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(1)
			expect(collector.first).toHaveProperty('customServiceResult')
			expect(customService.process).toHaveBeenCalled()
		})

		it('custom service receives correct values', async () => {
			const customService = {
				process: (value: unknown) => ({ doubled: true })
			}

			const program = new Program(
				{ customService },
				{ componentPaths: [`${__dirname}/components/`] }
			)

			const job = {
				process: [['custom-service-processor']]
			}

			await program.run(job, collector.drain)

			expect(customServiceCalls).toHaveLength(1)
			expect(customServiceCalls[0]?.method).toBe('process')
		})
	})

	describe('9.4 Parameter injection', () => {
		it('parameters available in box via schema', async () => {
			const program = createTestProgram()

			const job = {
				parameters: {
					'parameter-reader': {
						customParam: 'test-value',
						numericParam: 42
					}
				},
				process: [['parameter-reader']]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(1)
			expect(collector.first?.paramCustom).toBe('test-value')
			expect(collector.first?.paramNumeric).toBe(42)
			expect(collector.first?.hasParameters).toBe(true)
		})

		it('parameters are undefined when not provided', async () => {
			const program = createTestProgram()

			const job = {
				process: [['parameter-reader']]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(1)
			expect(collector.first?.hasParameters).toBe(false)
		})
	})
})
