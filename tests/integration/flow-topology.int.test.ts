/**
 * Flow Topology Integration Tests
 *
 * Tests validating different flow structures and box arrangements.
 * Test cases 1.1-1.8 from the Integration Test Plan.
 */
import { Program } from 'bakeryjs'
import { createTestProgram } from './helpers/test-program'
import { MessageCollector } from './helpers/message-collector'
import { EventTracker } from './helpers/event-tracker'

describe('Flow Topology Integration Tests', () => {
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

	describe('1.1 Single box flow', () => {
		it('processes single box and drains message', async () => {
			const job = { process: [['helloworld']] }

			await program.run(job, collector.drain)

			expect(collector.count).toBe(1)
			expect(collector.first).toHaveProperty('msg', 'Hello World!')
		})

		it('emits sent events for single box', async () => {
			const job = { process: [['identity-processor']] }

			await program.run(job, collector.drain)

			expect(eventTracker.sentCount).toBeGreaterThan(0)
		})
	})

	describe('1.2 Linear flow (A → B → C)', () => {
		it('processes messages sequentially through all boxes', async () => {
			const job = { process: [['helloworld'], ['wordcount'], ['checksum']] }

			await program.run(job, collector.drain)

			expect(collector.count).toBe(1)
			expect(collector.first).toHaveProperty('msg')
			expect(collector.first).toHaveProperty('words')
			expect(collector.first).toHaveProperty('checksum')
		})

		it('maintains data through the chain', async () => {
			const job = { process: [['helloworld'], ['wordcount', 'punctcount'], ['checksum']] }

			await program.run(job, collector.drain)

			expect(collector.first).toBeDefined()
			const message = collector.first
			expect(message?.msg).toBe('Hello World!')
			expect(message?.words).toBe(3) // "Hello", "World", ""
			expect(typeof message?.checksum).toBe('number')
		})
	})

	describe('1.3 Parallel boxes same level', () => {
		it('both boxes process the same message in parallel', async () => {
			// Parallel boxes that are joined by a downstream box
			const job = { process: [['helloworld'], ['wordcount', 'punctcount'], ['checksum']] }

			await program.run(job, collector.drain)

			// After join, we get 1 message with all fields
			expect(collector.count).toBe(1)
			expect(collector.first).toHaveProperty('words')
			expect(collector.first).toHaveProperty('punct')
			expect(collector.first).toHaveProperty('checksum')
		})

		it('events show parallel transitions', async () => {
			const job = { process: [['helloworld'], ['wordcount', 'punctcount'], ['checksum']] }

			await program.run(job, collector.drain)

			const toWordcount = eventTracker.getTransitionsTo('wordcount')
			const toPunctcount = eventTracker.getTransitionsTo('punctcount')

			expect(toWordcount.length).toBeGreaterThan(0)
			expect(toPunctcount.length).toBeGreaterThan(0)
		})
	})

	describe('1.4 Fan-out then join', () => {
		it('joins after both parallel branches complete', async () => {
			// helloworld -> [wordcount, punctcount] -> checksum
			const job = { process: [['helloworld'], ['wordcount', 'punctcount'], ['checksum']] }

			await program.run(job, collector.drain)

			expect(collector.count).toBe(1)
			// checksum requires both words and punct, so both must have completed
			expect(collector.first).toHaveProperty('checksum')
		})
	})

	describe('1.5 Diamond pattern', () => {
		it('D receives merged results from both B and C branches', async () => {
			// Use field-a-provider and field-b-provider in parallel, then merge-fields
			const job = {
				process: [
					['identity-processor'],
					['field-a-provider', 'field-b-provider'],
					['merge-fields']
				]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(1)
			expect(collector.first).toHaveProperty('fieldA', 'valueA')
			expect(collector.first).toHaveProperty('fieldB', 'valueB')
			expect(collector.first).toHaveProperty('mergedField', 'valueA+valueB')
		})
	})

	describe('1.6 Wide fan-out', () => {
		it('handles 4 parallel boxes then join', async () => {
			// Wide fan-out: 4 parallel boxes that are joined by merge-fields
			const job = {
				process: [
					['helloworld'],
					['field-a-provider', 'field-b-provider', 'wordcount', 'punctcount'],
					['merge-fields']
				]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(1)
			expect(collector.first).toHaveProperty('fieldA')
			expect(collector.first).toHaveProperty('fieldB')
			expect(collector.first).toHaveProperty('words')
			expect(collector.first).toHaveProperty('punct')
			expect(collector.first).toHaveProperty('mergedField')
		})
	})

	describe('1.7 Deep linear chain', () => {
		it('processes 5-level deep flow', async () => {
			// 5-level deep chain using different processors at each level
			const job = {
				process: [
					['helloworld'],
					['wordcount'],
					['punctcount'],
					['field-provider'],
					['field-reader']
				]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(1)
			expect(collector.first).toHaveProperty('msg')
			expect(collector.first).toHaveProperty('words')
			expect(collector.first).toHaveProperty('punct')
			expect(collector.first).toHaveProperty('providedField')
			expect(collector.first).toHaveProperty('readValue')
		})
	})

	describe('1.8 Complex mixed topology', () => {
		it('handles multiple parallel and serial stages', async () => {
			// Complex flow with generator, parallel branches, and multiple stages
			const job = {
				parameters: { 'configurable-generator': { count: 2 } },
				process: [
					[
						{
							'configurable-generator': [
								['transform-processor'],
								['field-a-provider', 'field-b-provider'],
								['merge-fields']
							]
						}
					]
				]
			}

			await program.run(job, collector.drain)

			// Each of the 2 generated messages should flow through
			expect(collector.count).toBe(2)
			collector.messages.forEach(msg => {
				expect(msg).toHaveProperty('value') // From generator
				expect(msg).toHaveProperty('transformed') // From transform-processor
				expect(msg).toHaveProperty('fieldA') // From field-a-provider
				expect(msg).toHaveProperty('fieldB') // From field-b-provider
				expect(msg).toHaveProperty('mergedField') // From merge-fields
			})
		})

		it('all messages correctly route through topology', async () => {
			const job = {
				parameters: { 'configurable-generator': { count: 3 } },
				process: [[{ 'configurable-generator': [['transform-processor'], ['field-provider']] }]]
			}

			await program.run(job, collector.drain)

			expect(collector.count).toBe(3)
			expect(eventTracker.getTransitionsTo('transform-processor').length).toBeGreaterThan(0)
			expect(eventTracker.getTransitionsTo('field-provider').length).toBeGreaterThan(0)
		})
	})
})
