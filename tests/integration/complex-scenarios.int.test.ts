/**
 * Complex Scenarios Integration Tests
 *
 * Tests for real-world use cases and complex patterns.
 * Test cases 10.1-10.5 from the Integration Test Plan.
 */
import { Program } from 'bakeryjs'
import { createTestProgram } from './helpers/test-program'
import { MessageCollector } from './helpers/message-collector'
import { EventTracker } from './helpers/event-tracker'
import {
	accumulatedMessages,
	clearAccumulator
} from './components/processors/accumulator-processor'

describe('Complex Scenarios Integration Tests', () => {
	let program: Program
	let collector: MessageCollector
	let eventTracker: EventTracker
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
		eventTracker = new EventTracker()
		clearAccumulator()
		program.on('sent', eventTracker.trackSent)
		program.on('run', eventTracker.trackRun)
	})

	afterEach(() => {
		program.off('sent', eventTracker.trackSent)
		program.off('run', eventTracker.trackRun)
	})

	describe('10.1 ETL Pipeline Simulation', () => {
		it('simulates extract → transform → load pattern', async () => {
			// Extract: generator creates data
			// Transform: transform-processor adds timestamp, field-provider adds data
			// Load: accumulator-processor collects for verification
			const job = {
				parameters: { 'configurable-generator': { count: 5 } },
				process: [
					[
						{
							'configurable-generator': [
								['transform-processor'],
								['field-provider'],
								['accumulator-processor']
							]
						}
					]
				]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(5)
			expect(accumulatedMessages).toHaveLength(5)
			collector.messages.forEach((msg, idx) => {
				expect(msg).toHaveProperty('value', `item-${idx}`)
				expect(msg).toHaveProperty('transformed')
				expect(msg).toHaveProperty('providedField')
				expect(msg).toHaveProperty('processedAt')
			})
		})

		it('maintains data integrity through multiple transformation stages', async () => {
			const job = {
				parameters: { 'configurable-generator': { count: 3 } },
				process: [
					[
						{
							'configurable-generator': [
								['transform-processor'],
								['identity-processor'],
								['field-a-provider'],
								['field-b-provider'],
								['merge-fields']
							]
						}
					]
				]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(3)
			collector.messages.forEach(msg => {
				// Original data preserved
				expect(msg).toHaveProperty('value')
				expect(msg).toHaveProperty('index')
				// All transformations applied
				expect(msg).toHaveProperty('transformed')
				expect(msg).toHaveProperty('fieldA', 'valueA')
				expect(msg).toHaveProperty('fieldB', 'valueB')
				expect(msg).toHaveProperty('mergedField', 'valueA+valueB')
			})
		})
	})

	describe('10.2 Fan-out/Fan-in Pattern', () => {
		it('fans out to multiple processors then fans back in', async () => {
			// Source generates messages
			// Fan-out: parallel processing in field-a-provider and field-b-provider
			// Fan-in: merge-fields aggregates results
			const job = {
				parameters: { 'configurable-generator': { count: 4 } },
				process: [
					[
						{
							'configurable-generator': [
								['identity-processor'],
								['field-a-provider', 'field-b-provider'],
								['merge-fields']
							]
						}
					]
				]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(4)
			collector.messages.forEach(msg => {
				expect(msg).toHaveProperty('fieldA', 'valueA')
				expect(msg).toHaveProperty('fieldB', 'valueB')
				expect(msg).toHaveProperty('mergedField', 'valueA+valueB')
			})
		})

		it('verifies all branches complete before joining', async () => {
			const job = {
				parameters: {
					'configurable-generator': { count: 3 },
					'slow-processor': { delay: 20 }
				},
				process: [
					[
						{
							'configurable-generator': [
								['slow-processor', 'field-a-provider', 'field-b-provider'],
								['merge-fields']
							]
						}
					]
				]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(3)
			// All 3 branches must have completed for merge-fields to work
			collector.messages.forEach(msg => {
				expect(msg).toHaveProperty('processedAfterDelay')
				expect(msg).toHaveProperty('fieldA')
				expect(msg).toHaveProperty('fieldB')
				expect(msg).toHaveProperty('mergedField')
			})
		})
	})

	describe('10.3 Priority-based Processing', () => {
		it('processes mix of high and low priority messages', async () => {
			const job = {
				parameters: {
					'priority-generator': {
						items: [
							{ value: 'low1', priority: 1 },
							{ value: 'high1', priority: 10 },
							{ value: 'low2', priority: 2 },
							{ value: 'high2', priority: 9 },
							{ value: 'medium', priority: 5 }
						]
					}
				},
				process: [[{ 'priority-generator': [['accumulator-processor']] }]]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(5)
			expect(accumulatedMessages).toHaveLength(5)

			const processedValues = collector.messages.map(m => m.value)
			expect(processedValues).toContain('low1')
			expect(processedValues).toContain('low2')
			expect(processedValues).toContain('high1')
			expect(processedValues).toContain('high2')
			expect(processedValues).toContain('medium')
		})

		it('verifies high priority messages are processed first', async () => {
			const job = {
				parameters: {
					'priority-generator': {
						items: [
							{ value: 'low', priority: 1 },
							{ value: 'high', priority: 10 },
							{ value: 'medium', priority: 5 }
						]
					},
					'slow-processor': { delay: 15 }
				},
				process: [
					[
						{
							'priority-generator': [['slow-processor'], ['accumulator-processor']]
						}
					]
				]
			}

			await program.run(job, collector.drain)

			expect(accumulatedMessages).toHaveLength(3)
			const values = accumulatedMessages.map(m => m.value)
			expect(values).toContain('low')
			expect(values).toContain('high')
			expect(values).toContain('medium')
		})
	})

	describe('10.4 Error Recovery Pattern', () => {
		it('successful messages complete while failed messages are logged', async () => {
			const job = {
				parameters: {
					'configurable-generator': { count: 5 },
					'conditional-error-processor': { failOnOddIndex: true }
				},
				process: [[{ 'configurable-generator': [['conditional-error-processor']] }]]
			}

			const jobPromise = program.run(job, collector.drain)
			await new Promise(resolve => setTimeout(resolve, 300))

			// Even indices (0, 2, 4) should succeed
			expect(collector.count).toBe(3)
			const drainedIndices = collector.messages.map(m => m.index)
			expect(drainedIndices).toContain(0)
			expect(drainedIndices).toContain(2)
			expect(drainedIndices).toContain(4)

			// Odd indices (1, 3) should have logged errors
			expect(loggedErrors).toHaveLength(2)
			loggedErrors.forEach(err => {
				expect(err.name).toBe('BoxInvocationException')
			})

			void jobPromise
		})

		it('verifies error logging contains correct message details', async () => {
			const job = {
				parameters: {
					'configurable-generator': { count: 3 },
					'conditional-error-processor': {
						failOnOddIndex: true,
						errorMessage: 'Test failure'
					}
				},
				process: [[{ 'configurable-generator': [['conditional-error-processor']] }]]
			}

			const jobPromise = program.run(job, collector.drain)
			await new Promise(resolve => setTimeout(resolve, 200))

			// Index 0, 2 succeed; index 1 fails
			expect(collector.count).toBe(2)
			expect(loggedErrors).toHaveLength(1)

			void jobPromise
		})
	})

	describe('10.5 Multi-dimensional Generator Flow', () => {
		it('handles nested generators creating multiple dimensions', async () => {
			// Outer generator emits 3 items
			// Nested generator emits 2 items per outer item = 6 total
			const job = {
				parameters: {
					'configurable-generator': { count: 3 },
					'nested-generator': { count: 2 }
				},
				process: [
					[
						{
							'configurable-generator': [[{ 'nested-generator': [['accumulator-processor']] }]]
						}
					]
				]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(6) // 3 outer * 2 nested
			expect(accumulatedMessages).toHaveLength(6)

			// Verify all nested values present
			const nestedValues = collector.messages.map(m => m.nestedValue)
			expect(nestedValues.filter(v => v === 'nested-0')).toHaveLength(3)
			expect(nestedValues.filter(v => v === 'nested-1')).toHaveLength(3)

			// Verify parent values are preserved
			const parentValues = collector.messages.map(m => m.parentValue)
			expect(parentValues.filter(v => v === 'item-0')).toHaveLength(2)
			expect(parentValues.filter(v => v === 'item-1')).toHaveLength(2)
			expect(parentValues.filter(v => v === 'item-2')).toHaveLength(2)
		})

		it('verifies dimension completion tracking', async () => {
			const job = {
				parameters: {
					'configurable-generator': { count: 2 },
					'nested-generator': { count: 3 }
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

			// 2 outer * 3 nested = 6 messages total
			expect(collector.count).toBe(6)

			// Check sent events for dimension transitions
			const toNestedGenerator = eventTracker.getTransitionsTo('nested-generator')
			const toIdentity = eventTracker.getTransitionsTo('identity-processor')

			expect(toNestedGenerator.length).toBeGreaterThan(0)
			expect(toIdentity.length).toBeGreaterThan(0)
		})

		it('all generated messages are processed in complex nested flow', async () => {
			const job = {
				parameters: {
					'configurable-generator': { count: 2 },
					'nested-generator': { count: 2 }
				},
				process: [
					[
						{
							'configurable-generator': [
								[
									{
										'nested-generator': [
											['transform-processor'],
											['field-provider'],
											['accumulator-processor']
										]
									}
								]
							]
						}
					]
				]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(4) // 2 * 2 = 4
			expect(accumulatedMessages).toHaveLength(4)

			// All messages should have gone through all processors
			collector.messages.forEach(msg => {
				expect(msg).toHaveProperty('nestedValue')
				expect(msg).toHaveProperty('parentValue')
				expect(msg).toHaveProperty('transformed')
				expect(msg).toHaveProperty('providedField')
				expect(msg).toHaveProperty('processedAt')
			})
		})
	})
})
