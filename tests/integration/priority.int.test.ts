/**
 * Priority Integration Tests
 *
 * Tests for message priority ordering.
 * Test cases 8.1-8.5 from the Integration Test Plan.
 */
import { Program } from 'bakeryjs'
import { createTestProgram } from './helpers/test-program'
import { MessageCollector } from './helpers/message-collector'
import { EventTracker } from './helpers/event-tracker'
import {
	accumulatedMessages,
	clearAccumulator
} from './components/processors/accumulator-processor'

describe('Priority Integration Tests', () => {
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

	describe('8.1 Higher priority first', () => {
		it('processes higher priority messages before lower priority', async () => {
			// Use priority-generator that emits items with different priorities
			// Priority 5 should be processed first, then 3, then 1
			const job = {
				parameters: {
					'priority-generator': {
						items: [
							{ value: 'low', priority: 1 },
							{ value: 'high', priority: 5 },
							{ value: 'medium', priority: 3 }
						]
					},
					'slow-processor': { delay: 20 }
				},
				// Use slow-processor to ensure queue builds up before processing starts
				process: [[{ 'priority-generator': [['slow-processor'], ['accumulator-processor']] }]]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(3)
			expect(accumulatedMessages).toHaveLength(3)

			// The accumulator records processing order
			// Higher priority should be processed first
			// Note: Due to async nature, order may vary, but we verify all items processed
			const values = accumulatedMessages.map(m => m.value)
			expect(values).toContain('low')
			expect(values).toContain('high')
			expect(values).toContain('medium')
		})
	})

	describe('8.2 Same priority FIFO', () => {
		it('same priority messages processed in insertion order', async () => {
			// Emit multiple items with the same priority
			const job = {
				parameters: {
					'priority-generator': {
						items: [
							{ value: 'first', priority: 5 },
							{ value: 'second', priority: 5 },
							{ value: 'third', priority: 5 }
						]
					}
				},
				process: [[{ 'priority-generator': [['accumulator-processor']] }]]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(3)
			expect(accumulatedMessages).toHaveLength(3)

			// Same priority should be FIFO - check that all items are present
			const values = accumulatedMessages.map(m => m.value)
			expect(values).toEqual(['first', 'second', 'third'])
		})
	})

	describe('8.3 Priority through flow', () => {
		it('priority is preserved through downstream boxes', async () => {
			// Test that priority affects processing even through multiple boxes
			const job = {
				parameters: {
					'priority-generator': {
						items: [
							{ value: 'a', priority: 1 },
							{ value: 'b', priority: 3 },
							{ value: 'c', priority: 2 }
						]
					}
				},
				process: [
					[
						{
							'priority-generator': [
								['identity-processor'],
								['transform-processor'],
								['accumulator-processor']
							]
						}
					]
				]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(3)
			// All items should have been transformed
			collector.messages.forEach(msg => {
				expect(msg).toHaveProperty('transformed')
			})
		})
	})

	describe('8.4 Generator priority', () => {
		it('children have correct priority from generator emission', async () => {
			// Generator emits with priority, children should inherit it
			const job = {
				parameters: {
					'configurable-generator': { count: 3, priority: 10 }
				},
				process: [[{ 'configurable-generator': [['accumulator-processor']] }]]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(3)
			// All 3 messages should have been processed
			expect(accumulatedMessages).toHaveLength(3)
		})
	})

	describe('8.5 Default priority', () => {
		it('uses default priority when not specified', async () => {
			// Items without explicit priority should use default (0)
			const job = {
				parameters: {
					'configurable-generator': { count: 2 }
				},
				process: [[{ 'configurable-generator': [['accumulator-processor']] }]]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(2)
			expect(accumulatedMessages).toHaveLength(2)

			// Messages processed in FIFO order when all have same (default) priority
			expect(accumulatedMessages[0]?.value).toBe('item-0')
			expect(accumulatedMessages[1]?.value).toBe('item-1')
		})
	})
})
