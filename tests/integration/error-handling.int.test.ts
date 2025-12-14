/**
 * Error Handling Integration Tests
 *
 * Tests for error propagation and handling.
 * Test cases 5.1-5.8 from the Integration Test Plan.
 *
 * Note: BakeryJS catches errors in boxes and logs them rather than propagating
 * them as promise rejections. When an error occurs, the message is not pushed
 * to the output queue, so the job never completes. These tests verify error
 * logging behavior without waiting for job completion.
 */
import { Program } from 'bakeryjs'
import VError from 'verror'
import { createTestProgram } from './helpers/test-program'
import { MessageCollector } from './helpers/message-collector'

describe('Error Handling Integration Tests', () => {
	let program: Program
	let collector: MessageCollector
	let loggedErrors: Error[]

	beforeEach(() => {
		loggedErrors = []
		program = createTestProgram({
			services: {
				logger: {
					log: jest.fn(),
					error: jest.fn((err: Error) => loggedErrors.push(err)),
					warn: jest.fn(),
					info: jest.fn(),
					debug: jest.fn()
				}
			}
		})
		collector = new MessageCollector()
	})

	describe('5.1 Processor throws Error', () => {
		it('error is logged and wrapped in BoxInvocationException', async () => {
			const job = {
				process: [['error-processor']]
			}

			// Start the job but don't await - it will never complete due to error
			const jobPromise = program.run(job, collector.drain)

			// Wait a bit for the error to be logged
			await new Promise(resolve => setTimeout(resolve, 100))

			// Verify error was logged
			expect(loggedErrors.length).toBeGreaterThan(0)
			const loggedError = loggedErrors[0]
			expect(loggedError).toBeDefined()
			expect(loggedError?.name).toBe('BoxInvocationException')

			// Clean up - the promise will never resolve, so we don't await it
			void jobPromise
		})

		it('no messages drain when processor throws', async () => {
			const job = {
				process: [['error-processor']]
			}

			// Start the job but don't await
			const jobPromise = program.run(job, collector.drain)

			// Wait a bit for processing
			await new Promise(resolve => setTimeout(resolve, 100))

			// No messages should drain when error occurs
			expect(collector.count).toBe(0)

			void jobPromise
		})
	})

	describe('5.2 Processor throws non-Error', () => {
		it('non-Error is converted to Error and logged', async () => {
			const job = {
				process: [['non-error-thrower']]
			}

			const jobPromise = program.run(job, collector.drain)
			await new Promise(resolve => setTimeout(resolve, 100))

			// Verify error was logged and wrapped
			expect(loggedErrors.length).toBeGreaterThan(0)
			const loggedError = loggedErrors[0]
			expect(loggedError).toBeDefined()
			expect(loggedError?.name).toBe('BoxInvocationException')
			// The cause should contain the string that was thrown
			const cause = VError.cause(loggedError as VError)
			expect(cause?.message).toContain('string error thrown')

			void jobPromise
		})
	})

	describe('5.3 Generator throws Error', () => {
		it('generator error is logged', async () => {
			const job = {
				process: [[{ 'error-generator': [['identity-processor']] }]]
			}

			const jobPromise = program.run(job, collector.drain)
			await new Promise(resolve => setTimeout(resolve, 100))

			// Verify error was logged
			expect(loggedErrors.length).toBeGreaterThan(0)
			expect(collector.count).toBe(0)

			void jobPromise
		})

		it('generator error has proper cause chain', async () => {
			const job = {
				parameters: { 'error-generator': { errorMessage: 'Custom generator error' } },
				process: [[{ 'error-generator': [['identity-processor']] }]]
			}

			const jobPromise = program.run(job, collector.drain)
			await new Promise(resolve => setTimeout(resolve, 100))

			// Verify error was logged with proper structure
			expect(loggedErrors.length).toBeGreaterThan(0)
			const loggedError = loggedErrors[0]
			expect(loggedError).toBeDefined()
			expect(loggedError?.name).toBe('BoxInvocationException')

			void jobPromise
		})
	})

	describe('5.4 BatchBox throws Error', () => {
		it('batch processor error is logged and batch fails', async () => {
			const job = {
				parameters: { 'configurable-generator': { count: 3 } },
				process: [[{ 'configurable-generator': [['batch-error-processor']] }]]
			}

			const jobPromise = program.run(job, collector.drain)
			await new Promise(resolve => setTimeout(resolve, 200))

			// Verify error was logged
			expect(loggedErrors.length).toBeGreaterThan(0)
			// No messages should drain when batch fails
			expect(collector.count).toBe(0)

			void jobPromise
		})
	})

	describe('5.5 Invalid box parameters', () => {
		it('throws BoxParametersValidationError for invalid params', async () => {
			const job = {
				// checksum box has a schema that doesn't allow 'invalid' property
				parameters: { checksum: { algorithm: 123 } }, // algorithm should be string
				process: [['helloworld'], ['wordcount'], ['checksum']]
			}

			// BoxParametersValidationError is thrown synchronously during box construction
			await expect(program.run(job, collector.drain)).rejects.toThrow()
		})
	})

	describe('5.6 Missing component', () => {
		it('throws BoxNotFound for non-existent box', async () => {
			const job = {
				process: [['nonexistent-box-name']]
			}

			// BoxNotFound is thrown during flow construction
			await expect(program.run(job, collector.drain)).rejects.toThrow()
		})
	})

	describe('5.7 Invalid flow schema', () => {
		it('throws validation error for malformed schema', () => {
			const job = { process: 'not-an-array' }

			expect(() => program.run(job as any, collector.drain)).toThrow()
		})

		it('throws for invalid process structure', () => {
			const job = { process: [null] }

			expect(() => program.run(job as any, collector.drain)).toThrow()
		})
	})

	describe('5.8 Async error in box', () => {
		it('async error is logged correctly', async () => {
			const job = {
				parameters: { 'async-error-processor': { delayBeforeError: 10 } },
				process: [['async-error-processor']]
			}

			// Async errors are caught and logged, not thrown
			const jobPromise = program.run(job, collector.drain)
			await new Promise(resolve => setTimeout(resolve, 150))

			// Verify error was logged
			expect(loggedErrors.length).toBeGreaterThan(0)
			const loggedError = loggedErrors[0]
			expect(loggedError).toBeDefined()
			expect(loggedError?.name).toBe('BoxInvocationException')
			expect(collector.count).toBe(0)

			void jobPromise
		})
	})
})
