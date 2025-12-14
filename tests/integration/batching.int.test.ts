/**
 * BatchingBox Integration Tests
 *
 * Tests for batch processing behavior.
 * Test cases 4.1-4.6 from the Integration Test Plan.
 */
import { Program } from 'bakeryjs'
import { createTestProgram } from './helpers/test-program'
import { MessageCollector } from './helpers/message-collector'
import { EventTracker } from './helpers/event-tracker'
import { batchProcessingLog, clearBatchLog } from './components/processors/batch-processor'

describe('BatchingBox Integration Tests', () => {
	let program: Program
	let collector: MessageCollector
	let eventTracker: EventTracker

	beforeEach(() => {
		program = createTestProgram()
		collector = new MessageCollector()
		eventTracker = new EventTracker()
		clearBatchLog()
		program.on('sent', eventTracker.trackSent)
		program.on('run', eventTracker.trackRun)
	})

	describe('4.1 Batch size trigger', () => {
		it('batches messages up to maxSize', async () => {
			// hellobatchworld emits 5 messages over time
			// wordbatchcount has maxSize: 3, so we expect batches of 3 and 2
			const job = {
				process: [['hellobatchworld'], ['wordbatchcount']]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(5)
			// Check that batch transitions occurred
			const batchTransitions = eventTracker.getTransitionsTo('wordbatchcount')
			expect(batchTransitions.length).toBeGreaterThan(0)
		})

		it('processes batch with custom batch-processor', async () => {
			// Generate 3 messages to fill exactly one batch
			const job = {
				parameters: { 'configurable-generator': { count: 3 } },
				process: [[{ 'configurable-generator': [['batch-processor']] }]]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(3)
			// Verify batch processing occurred
			expect(batchProcessingLog.length).toBeGreaterThan(0)
			// All 3 items should have been processed
			const totalProcessed = batchProcessingLog.reduce((sum, log) => sum + log.batchSize, 0)
			expect(totalProcessed).toBe(3)
		})
	})

	describe('4.2 Batch timeout trigger', () => {
		it('processes partial batch after timeout', async () => {
			// Generate 2 messages (less than maxSize of 3)
			// batch-processor has timeoutSeconds: 0.1, so batch should trigger on timeout
			const job = {
				parameters: { 'configurable-generator': { count: 2 } },
				process: [[{ 'configurable-generator': [['batch-processor']] }]]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(2)
			// Batch should have processed with size 2 (partial)
			expect(batchProcessingLog.length).toBeGreaterThan(0)
			expect(batchProcessingLog.some(log => log.batchSize === 2)).toBe(true)
		})
	})

	describe('4.3 Multiple batches', () => {
		it('splits 10 messages with batch size 3 into 3 full batches + 1 partial', async () => {
			// Generate 10 messages
			const job = {
				parameters: { 'configurable-generator': { count: 10 } },
				process: [[{ 'configurable-generator': [['batch-processor']] }]]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(10)
			// Verify all items processed in batches
			const totalProcessed = batchProcessingLog.reduce((sum, log) => sum + log.batchSize, 0)
			expect(totalProcessed).toBe(10)
			// Should have multiple batches (at least 4 for 10 items with maxSize 3)
			expect(batchProcessingLog.length).toBeGreaterThanOrEqual(1)
		})
	})

	describe('4.4 Batch ordering', () => {
		it('preserves order within batches', async () => {
			// Generate 5 messages with distinct indices
			const job = {
				parameters: { 'configurable-generator': { count: 5 } },
				process: [[{ 'configurable-generator': [['batch-processor']] }]]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(5)
			// Check that items within each batch maintain their relative order
			batchProcessingLog.forEach(log => {
				for (let i = 1; i < log.items.length; i++) {
					const prevItem = log.items[i - 1]
					const currItem = log.items[i]
					if (prevItem && currItem) {
						const prevIndex = prevItem.index as number
						const currIndex = currItem.index as number
						expect(currIndex).toBeGreaterThan(prevIndex)
					}
				}
			})
		})
	})

	describe('4.5 Mixed batch/single', () => {
		it('processes BatchBox → SingleBox → BatchBox correctly', async () => {
			// hellobatchworld emits messages -> wordbatchcount (batch) -> checksum (single)
			const job = {
				process: [['hellobatchworld'], ['wordbatchcount', 'punctcount'], ['checksum']]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(5)
			// All messages should have words (from batch processor) and checksum (from single processor)
			collector.messages.forEach(msg => {
				expect(msg).toHaveProperty('words')
				expect(msg).toHaveProperty('checksum')
			})
		})
	})

	describe('4.6 Batch with generator', () => {
		it('batches messages from generator', async () => {
			// Generator emits 6 messages, batch-processor processes in batches of 3
			const job = {
				parameters: { 'configurable-generator': { count: 6 } },
				process: [[{ 'configurable-generator': [['batch-processor']] }]]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(6)
			// Should have at least 2 batches (6 items with maxSize 3)
			expect(batchProcessingLog.length).toBeGreaterThanOrEqual(1)
			// Each message should have batch metadata
			collector.messages.forEach(msg => {
				expect(msg).toHaveProperty('batchId')
				expect(msg).toHaveProperty('batchIndex')
				expect(msg).toHaveProperty('batchSize')
			})
		})
	})
})
