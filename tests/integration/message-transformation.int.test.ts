/**
 * Message Transformation Integration Tests
 *
 * Tests for message data flow and field handling.
 * Test cases 3.1-3.7 from the Integration Test Plan.
 */
import { Program } from 'bakeryjs'
import { createTestProgram } from './helpers/test-program'
import { MessageCollector } from './helpers/message-collector'
import { EventTracker } from './helpers/event-tracker'

describe('Message Transformation Integration Tests', () => {
	let program: Program
	let collector: MessageCollector
	let eventTracker: EventTracker

	beforeEach(() => {
		program = createTestProgram()
		collector = new MessageCollector()
		eventTracker = new EventTracker()
		program.on('sent', eventTracker.trackSent)
		program.on('run', eventTracker.trackRun)
	})

	describe('3.1 Field provision', () => {
		it('box provides field that downstream boxes can access', async () => {
			const job = {
				process: [['field-provider'], ['field-reader']]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(1)
			expect(collector.first).toHaveProperty('providedField')
			expect(collector.first).toHaveProperty('readValue', 'provided-value')
		})

		it('provided field is available in final message', async () => {
			const job = {
				process: [['helloworld'], ['wordcount']]
			}

			await program.run(job, collector.drain)

			expect(collector.first).toHaveProperty('msg', 'Hello World!')
			expect(collector.first).toHaveProperty('words')
		})
	})

	describe('3.2 Field requirement', () => {
		it('box receives required field from upstream', async () => {
			const job = {
				process: [['helloworld'], ['wordcount']]
			}

			await program.run(job, collector.drain)

			expect(collector.first).toHaveProperty('words')
			// wordcount requires 'msg' and provides 'words'
			expect(collector.first).toBeDefined()
			expect(typeof collector.first?.words).toBe('number')
		})

		it('checksum requires both words and punct', async () => {
			const job = {
				process: [['helloworld'], ['wordcount', 'punctcount'], ['checksum']]
			}

			await program.run(job, collector.drain)

			expect(collector.first).toHaveProperty('checksum')
		})
	})

	describe('3.3 Field accumulation', () => {
		it('chain of boxes each adding fields results in final message with all fields', async () => {
			const job = {
				process: [
					['identity-processor'],
					['transform-processor'],
					['field-provider'],
					['field-a-provider'],
					['field-b-provider']
				]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(1)
			expect(collector.first).toHaveProperty('transformed')
			expect(collector.first).toHaveProperty('providedField')
			expect(collector.first).toHaveProperty('fieldA')
			expect(collector.first).toHaveProperty('fieldB')
		})

		it('generator sub-flow accumulates fields', async () => {
			const job = {
				parameters: { 'configurable-generator': { count: 2 } },
				process: [[{ 'configurable-generator': [['transform-processor'], ['field-provider']] }]]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(2)
			collector.messages.forEach(msg => {
				expect(msg).toHaveProperty('value') // from generator
				expect(msg).toHaveProperty('transformed') // from transform-processor
				expect(msg).toHaveProperty('providedField') // from field-provider
			})
		})
	})

	describe('3.4 Field immutability', () => {
		it('original field values are preserved through flow', async () => {
			const job = {
				process: [['helloworld'], ['wordcount'], ['identity-processor']]
			}

			await program.run(job, collector.drain)

			// Original field from helloworld should still be present
			expect(collector.first).toHaveProperty('msg', 'Hello World!')
		})
	})

	describe('3.5 Initial job values', () => {
		it('initial values are available throughout flow', async () => {
			const job = { process: [['checksum']] }

			await program.run(job, collector.drain, { words: 10, punct: 5 })

			expect(collector.count).toBe(1)
			expect(collector.first).toHaveProperty('words', 10)
			expect(collector.first).toHaveProperty('punct', 5)
			expect(collector.first).toHaveProperty('checksum')
		})

		it('initial values flow through multiple stages', async () => {
			const job = { process: [['identity-processor'], ['transform-processor']] }

			await program.run(job, collector.drain, { initialValue: 'test-data' })

			expect(collector.first).toHaveProperty('initialValue', 'test-data')
			expect(collector.first).toHaveProperty('transformed')
		})
	})

	describe('3.6 Data type preservation', () => {
		it('preserves various data types through flow', async () => {
			const job = { process: [['identity-processor']] }

			const initialData = {
				stringVal: 'test',
				numberVal: 42,
				boolVal: true,
				objectVal: { nested: 'value' },
				arrayVal: [1, 2, 3],
				nullVal: null
			}

			await program.run(job, collector.drain, initialData)

			expect(collector.first).toBeDefined()
			expect(collector.first?.stringVal).toBe('test')
			expect(collector.first?.numberVal).toBe(42)
			expect(collector.first?.boolVal).toBe(true)
			expect(collector.first?.objectVal).toEqual({ nested: 'value' })
			expect(collector.first?.arrayVal).toEqual([1, 2, 3])
			expect(collector.first?.nullVal).toBeNull()
		})
	})

	describe('3.7 Parent-child relationship', () => {
		it('generator creates child messages with correct parent reference', async () => {
			const job = {
				parameters: { 'configurable-generator': { count: 3 } },
				process: [[{ 'configurable-generator': [['identity-processor']] }]]
			}

			await program.run(job, collector.drain)

			// Each child message should have the generator's provided fields
			expect(collector.count).toBe(3)
			collector.messages.forEach((msg, idx) => {
				// Each child has its own index from the generator
				expect(msg).toHaveProperty('index')
				expect(msg).toHaveProperty('value')
			})
		})

		it('nested generator children have correct parent values', async () => {
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

			expect(collector.count).toBe(4) // 2 * 2
			// nested-generator captures parent value in 'parentValue' field
			collector.messages.forEach(msg => {
				expect(msg).toHaveProperty('nestedValue')
				expect(msg).toHaveProperty('parentValue')
				// Parent value should be from configurable-generator (item-0 or item-1)
				expect(['item-0', 'item-1']).toContain(msg.parentValue)
			})
		})
	})
})
