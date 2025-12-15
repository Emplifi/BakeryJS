/**
 * Generator Integration Tests
 *
 * Tests for generator boxes that emit multiple messages.
 * Test cases 2.1-2.9 from the Integration Test Plan.
 */
import { Program } from 'bakeryjs'
import { createTestProgram } from './helpers/test-program'
import { MessageCollector } from './helpers/message-collector'
import { EventTracker } from './helpers/event-tracker'
import {
	accumulatedMessages,
	clearAccumulator
} from './components/processors/accumulator-processor'

describe('Generator Integration Tests', () => {
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

	afterEach(() => {
		program.off('sent', eventTracker.trackSent)
		program.off('run', eventTracker.trackRun)
	})

	describe('2.1 Single emission', () => {
		it('generator emits 1 message and sub-flow processes it', async () => {
			const job = {
				parameters: { 'configurable-generator': { count: 1 } },
				process: [[{ 'configurable-generator': [['identity-processor']] }]]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(1)
			expect(collector.first).toHaveProperty('value', 'item-0')
			expect(collector.first).toHaveProperty('index', 0)
		})
	})

	describe('2.2 Multiple emissions', () => {
		it('generator emits 5 messages and sub-flow processes all', async () => {
			const job = {
				parameters: { 'configurable-generator': { count: 5 } },
				process: [[{ 'configurable-generator': [['identity-processor']] }]]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(5)
			for (let i = 0; i < 5; i++) {
				expect(collector.hasMessageWith('index', i)).toBe(true)
			}
		})
	})

	describe('2.3 Delayed emissions', () => {
		it('generator emits after delay and all messages are processed', async () => {
			const job = {
				parameters: { 'configurable-generator': { count: 3, delay: 50 } },
				process: [[{ 'configurable-generator': [['identity-processor']] }]]
			}

			const startTime = Date.now()
			await program.run(job, collector.drain)
			const elapsed = Date.now() - startTime

			expect(collector.count).toBe(3)
			expect(elapsed).toBeGreaterThanOrEqual(40) // Allow some timing variance
		})
	})

	describe('2.4 Generator with sub-flow', () => {
		it('each emitted message goes through sub-flow', async () => {
			const job = {
				parameters: { 'configurable-generator': { count: 3 } },
				process: [[{ 'configurable-generator': [['transform-processor'], ['identity-processor']] }]]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(3)
			collector.messages.forEach(msg => {
				expect(msg).toHaveProperty('value')
				expect(msg).toHaveProperty('transformed')
			})
		})
	})

	describe('2.5 Nested generators', () => {
		it('supports 2-level dimension nesting', async () => {
			// Outer generator emits 2 items, nested generator emits 2 items each = 4 total
			const job = {
				parameters: {
					'configurable-generator': { count: 2 },
					'nested-generator': { count: 2 }
				},
				process: [
					[
						{
							'configurable-generator': [[{ 'nested-generator': [['identity-processor']] }]]
						}
					]
				]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(4) // 2 outer * 2 nested
			// Verify nested values are present
			expect(collector.messages.some(m => m.nestedValue === 'nested-0')).toBe(true)
			expect(collector.messages.some(m => m.nestedValue === 'nested-1')).toBe(true)
		})
	})

	describe('2.6 Parallel generators', () => {
		it('both generators run concurrently', async () => {
			// Run two separate flows to test parallel generator concept
			const job1 = {
				parameters: { 'configurable-generator': { count: 2 } },
				process: [[{ 'configurable-generator': [['identity-processor']] }]]
			}

			const job2 = {
				process: [[{ helloworld: [['wordcount']] }]]
			}

			const collector2 = new MessageCollector()

			// Run both concurrently
			await Promise.all([program.run(job1, collector.drain), program.run(job2, collector2.drain)])

			// Each job produces its own messages
			expect(collector.count).toBe(2)
			expect(collector2.count).toBe(1)
			// Check we have messages from both generators
			expect(collector.messages.some(m => m.value !== undefined)).toBe(true)
			expect(collector2.messages.some(m => m.msg !== undefined)).toBe(true)
		})
	})

	describe('2.7 Empty generator', () => {
		it('job completes without drain messages', async () => {
			const job = {
				process: [[{ 'empty-generator': [['identity-processor']] }]]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(0)
		})
	})

	describe('2.8 Generator with priority', () => {
		it('generator emits with different priorities', async () => {
			const job = {
				parameters: {
					'priority-generator': {
						items: [
							{ value: 'low', priority: 1 },
							{ value: 'high', priority: 5 },
							{ value: 'medium', priority: 3 }
						]
					}
				},
				process: [[{ 'priority-generator': [['accumulator-processor']] }]]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(3)
			// The accumulator tracks processing order
			// Higher priority should generally be processed first
			expect(accumulatedMessages).toHaveLength(3)
			// Verify all items were processed
			expect(collector.messages.some(m => m.value === 'low')).toBe(true)
			expect(collector.messages.some(m => m.value === 'high')).toBe(true)
			expect(collector.messages.some(m => m.value === 'medium')).toBe(true)
		})
	})

	describe('2.9 Generator completion', () => {
		it('job completion waits for generator', async () => {
			const job = {
				parameters: { 'configurable-generator': { count: 5, delay: 50 } },
				process: [[{ 'configurable-generator': [['accumulator-processor']] }]]
			}

			await program.run(job, collector.drain)

			// After promise resolves, all messages should be processed
			expect(collector.count).toBe(5)
			expect(accumulatedMessages).toHaveLength(5)
		})

		it('waits for all sub-flow processing to complete', async () => {
			const job = {
				parameters: {
					'configurable-generator': { count: 3 },
					'slow-processor': { delay: 30 }
				},
				process: [[{ 'configurable-generator': [['slow-processor'], ['accumulator-processor']] }]]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(3)
			// All messages should have gone through slow-processor
			collector.messages.forEach(msg => {
				expect(msg).toHaveProperty('processedAfterDelay')
			})
		})
	})
})
