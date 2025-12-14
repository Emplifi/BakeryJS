/**
 * Job Lifecycle Integration Tests
 *
 * Tests for job execution and completion detection.
 * Test cases 6.1-6.7 from the Integration Test Plan.
 */
import { Program } from 'bakeryjs'
import { createTestProgram } from './helpers/test-program'
import { MessageCollector } from './helpers/message-collector'
import { EventTracker } from './helpers/event-tracker'
import {
	accumulatedMessages,
	clearAccumulator
} from './components/processors/accumulator-processor'

describe('Job Lifecycle Integration Tests', () => {
	let program: Program
	let collector: MessageCollector
	let eventTracker: EventTracker

	beforeEach(() => {
		program = createTestProgram()
		collector = new MessageCollector()
		eventTracker = new EventTracker()
		clearAccumulator()
		program.on('sent', eventTracker.trackSent)
		program.on('run', eventTracker.trackRun)
	})

	describe('6.1 Simple job completion', () => {
		it('linear flow completes and promise resolves', async () => {
			const job = { process: [['helloworld'], ['wordcount'], ['checksum']] }

			const result = await program.run(job, collector.drain)

			// Promise should resolve (not reject)
			expect(result).toBeUndefined() // run() returns void
			expect(collector.count).toBe(1)
		})

		it('drain callback is called for completed job', async () => {
			const job = { process: [['helloworld']] }

			await program.run(job, collector.drain)

			expect(collector.count).toBe(1)
			expect(collector.first).toHaveProperty('msg', 'Hello World!')
		})
	})

	describe('6.2 Generator job completion', () => {
		it('waits for all children to complete', async () => {
			const job = {
				parameters: { 'configurable-generator': { count: 5 } },
				process: [[{ 'configurable-generator': [['slow-processor']] }]]
			}

			const startTime = Date.now()
			await program.run(job, collector.drain)
			const elapsed = Date.now() - startTime

			// All 5 children should complete
			expect(collector.count).toBe(5)
			// slow-processor has 50ms default delay, so should take some time
			expect(elapsed).toBeGreaterThanOrEqual(40)
		})

		it('all generated messages are processed before promise resolves', async () => {
			const job = {
				parameters: { 'configurable-generator': { count: 10, delay: 20 } },
				process: [[{ 'configurable-generator': [['accumulator-processor']] }]]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(10)
			expect(accumulatedMessages).toHaveLength(10)
		})
	})

	describe('6.3 Parallel job completion', () => {
		it('waits for all branches to complete', async () => {
			const job = {
				process: [
					['helloworld'],
					['wordcount', 'punctcount'],
					['field-a-provider', 'field-b-provider'],
					['checksum']
				]
			}

			await program.run(job, collector.drain)

			// All parallel branches completed and joined
			expect(collector.count).toBe(1)
			expect(collector.first).toHaveProperty('words')
			expect(collector.first).toHaveProperty('punct')
			expect(collector.first).toHaveProperty('fieldA')
			expect(collector.first).toHaveProperty('fieldB')
			expect(collector.first).toHaveProperty('checksum')
		})
	})

	describe('6.4 Nested generator completion', () => {
		it('all dimensions complete before job resolves', async () => {
			const job = {
				parameters: {
					'configurable-generator': { count: 2 },
					'nested-generator': { count: 3 }
				},
				process: [
					[{ 'configurable-generator': [[{ 'nested-generator': [['accumulator-processor']] }]] }]
				]
			}

			await program.run(job, collector.drain)

			// 2 outer * 3 nested = 6 total messages
			expect(collector.count).toBe(6)
			expect(accumulatedMessages).toHaveLength(6)
		})
	})

	describe('6.5 Multiple concurrent jobs', () => {
		it('handles 3 jobs running simultaneously', async () => {
			const job1 = { process: [['helloworld']] }
			const job2 = { process: [['helloworld'], ['wordcount']] }
			const job3 = { process: [['helloworld'], ['wordcount'], ['checksum']] }

			const collector1 = new MessageCollector()
			const collector2 = new MessageCollector()
			const collector3 = new MessageCollector()

			await Promise.all([
				program.run(job1, collector1.drain),
				program.run(job2, collector2.drain),
				program.run(job3, collector3.drain)
			])

			expect(collector1.count).toBe(1)
			expect(collector2.count).toBe(1)
			expect(collector3.count).toBe(1)

			expect(collector1.first).toHaveProperty('msg')
			expect(collector2.first).toHaveProperty('words')
			expect(collector3.first).toHaveProperty('checksum')
		})
	})

	describe('6.6 Job with drain callback', () => {
		it('all output messages collected through drain', async () => {
			const job = {
				parameters: { 'configurable-generator': { count: 7 } },
				process: [[{ 'configurable-generator': [['identity-processor']] }]]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(7)
			// Verify all indices are present
			for (let i = 0; i < 7; i++) {
				expect(collector.hasMessageWith('index', i)).toBe(true)
			}
		})
	})

	describe('6.7 Job without drain', () => {
		it('job still completes without drain callback', async () => {
			const job = { process: [['helloworld'], ['wordcount']] }

			// Run without drain callback - should not throw
			const result = await program.run(job)

			expect(result).toBeUndefined()
		})

		it('job with generator completes without drain', async () => {
			const job = {
				parameters: { 'configurable-generator': { count: 3 } },
				process: [[{ 'configurable-generator': [['identity-processor']] }]]
			}

			// Run without drain callback
			const result = await program.run(job)

			expect(result).toBeUndefined()
		})
	})
})
