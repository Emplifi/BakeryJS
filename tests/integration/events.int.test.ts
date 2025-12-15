/**
 * Events Integration Tests
 *
 * Tests for event emission and observability.
 * Test cases 7.1-7.6 from the Integration Test Plan.
 */
import { Program } from 'bakeryjs'
import { createTestProgram } from './helpers/test-program'
import { MessageCollector } from './helpers/message-collector'
import { EventTracker } from './helpers/event-tracker'
import { clearAccumulator } from './components/processors/accumulator-processor'

describe('Events Integration Tests', () => {
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

	describe('7.1 sent event emission', () => {
		it('emits sent event for each message transition', async () => {
			const job = {
				process: [['helloworld'], ['wordcount']]
			}

			await program.run(job, collector.drain, { punct: 1 })

			expect(eventTracker.sentCount).toBeGreaterThan(0)
			// Should have transitions to helloworld and wordcount
			expect(eventTracker.hasTransition('_root_', 'helloworld')).toBe(true)
			expect(eventTracker.hasTransition('helloworld', 'wordcount')).toBe(true)
		})

		it('emits sent event for parallel boxes', async () => {
			const job = {
				process: [['field-a-provider', 'field-b-provider'], ['merge-fields']]
			}

			await program.run(job, collector.drain)

			// Should have transitions to both parallel boxes
			expect(eventTracker.hasTransition('_root_', 'field-a-provider')).toBe(true)
			expect(eventTracker.hasTransition('_root_', 'field-b-provider')).toBe(true)
			// And transitions to merge-fields from both
			expect(eventTracker.hasTransition('field-a-provider', 'merge-fields')).toBe(true)
			expect(eventTracker.hasTransition('field-b-provider', 'merge-fields')).toBe(true)
		})
	})

	describe('7.2 sent event data', () => {
		it('contains timestamp, source, target, batchSize', async () => {
			const job = {
				process: [['identity-processor']]
			}

			await program.run(job, collector.drain)

			expect(eventTracker.sentEvents.length).toBeGreaterThan(0)

			const firstEvent = eventTracker.sentEvents[0]
			expect(firstEvent).toHaveProperty('timestamp')
			expect(firstEvent).toHaveProperty('source')
			expect(firstEvent).toHaveProperty('target')
			expect(firstEvent).toHaveProperty('batchSize')

			expect(typeof firstEvent?.timestamp).toBe('number')
			expect(typeof firstEvent?.source).toBe('string')
			expect(typeof firstEvent?.target).toBe('string')
			expect(typeof firstEvent?.batchSize).toBe('number')
		})

		it('timestamp is a valid number representing time', async () => {
			const before = Date.now()

			const job = {
				process: [['identity-processor']]
			}

			await program.run(job, collector.drain)
			const after = Date.now()

			const firstEvent = eventTracker.sentEvents[0]
			expect(firstEvent?.timestamp).toBeGreaterThanOrEqual(before)
			expect(firstEvent?.timestamp).toBeLessThanOrEqual(after)
		})
	})

	describe('7.3 run event emission', () => {
		it('emits run event when flow starts', async () => {
			const job = {
				process: [['identity-processor']]
			}

			expect(eventTracker.runEvents).toHaveLength(0)

			await program.run(job, collector.drain)

			expect(eventTracker.runEvents.length).toBeGreaterThan(0)
		})

		it('run event contains flow and job', async () => {
			const before = Date.now()

			const job = {
				process: [['identity-processor']]
			}

			await program.run(job, collector.drain)
			const after = Date.now()

			// The run event should have flow and job objects
			expect(eventTracker.runEvents[0]).toHaveProperty('flow')
			expect(eventTracker.runEvents[0]).toHaveProperty('job')
			// And our captured timestamp should be within the test window
			expect(eventTracker.runEvents[0]?.timestamp).toBeGreaterThanOrEqual(before)
			expect(eventTracker.runEvents[0]?.timestamp).toBeLessThanOrEqual(after)
		})
	})

	describe('7.4 Event ordering', () => {
		it('events are in correct order for sequential transitions', async () => {
			const job = {
				process: [['identity-processor'], ['transform-processor'], ['accumulator-processor']]
			}

			await program.run(job, collector.drain)

			// Find transition indices
			const transitions = eventTracker.getTransitions()

			const toIdentity = transitions.findIndex(t => t.to === 'identity-processor')
			const toTransform = transitions.findIndex(t => t.to === 'transform-processor')
			const toAccumulator = transitions.findIndex(t => t.to === 'accumulator-processor')

			expect(toIdentity).toBeLessThan(toTransform)
			expect(toTransform).toBeLessThan(toAccumulator)
		})

		it('events have monotonically increasing timestamps', async () => {
			const job = {
				parameters: { 'slow-processor': { delay: 10 } },
				process: [['slow-processor'], ['identity-processor']]
			}

			await program.run(job, collector.drain)

			for (let i = 1; i < eventTracker.sentEvents.length; i++) {
				const prevTimestamp = eventTracker.sentEvents[i - 1]?.timestamp ?? 0
				const currTimestamp = eventTracker.sentEvents[i]?.timestamp ?? 0
				expect(currTimestamp).toBeGreaterThanOrEqual(prevTimestamp)
			}
		})
	})

	describe('7.5 Batch size in events', () => {
		it('batchSize correctly reported as 1 for single message', async () => {
			const job = {
				process: [['identity-processor']]
			}

			await program.run(job, collector.drain)

			const transitionsToIdentity = eventTracker.getTransitionsTo('identity-processor')
			expect(transitionsToIdentity.length).toBeGreaterThan(0)
			expect(transitionsToIdentity[0]?.batchSize).toBe(1)
		})

		it('batchSize reflects number of messages in batch', async () => {
			const job = {
				parameters: { 'configurable-generator': { count: 5 } },
				process: [[{ 'configurable-generator': [['identity-processor']] }]]
			}

			await program.run(job, collector.drain)

			// The total batch size across all transitions to identity-processor should be 5
			const transitionsToIdentity = eventTracker.getTransitionsTo('identity-processor')
			const totalBatchSize = transitionsToIdentity.reduce((sum, t) => sum + t.batchSize, 0)
			expect(totalBatchSize).toBe(5)
		})
	})

	describe('7.6 Generator events', () => {
		it('events show generator to children flow', async () => {
			const job = {
				parameters: { 'configurable-generator': { count: 3 } },
				process: [[{ 'configurable-generator': [['identity-processor']] }]]
			}

			await program.run(job, collector.drain)

			// There should be transitions from root to configurable-generator
			expect(eventTracker.hasTransition('_root_', 'configurable-generator')).toBe(true)

			// And transitions from generator dimension to identity-processor
			const transitionsToIdentity = eventTracker.getTransitionsTo('identity-processor')
			expect(transitionsToIdentity.length).toBeGreaterThan(0)
		})

		it('generator emits expected number of child messages', async () => {
			const job = {
				parameters: { 'configurable-generator': { count: 4 } },
				process: [[{ 'configurable-generator': [['accumulator-processor']] }]]
			}

			await program.run(job, collector.drain)

			// The total messages processed should be 4
			const transitionsToAccumulator = eventTracker.getTransitionsTo('accumulator-processor')
			const totalMessages = transitionsToAccumulator.reduce((sum, t) => sum + t.batchSize, 0)
			expect(totalMessages).toBe(4)
			expect(collector.count).toBe(4)
		})
	})
})
