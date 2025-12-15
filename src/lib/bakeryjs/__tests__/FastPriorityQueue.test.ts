import { FastPriorityQueue, FastPriorityBatchQueue } from '../queue/FastPriorityQueue'
import { DataMessage, Message } from '../Message'

// FastPriorityQueue tests
describe('FastPriorityQueue', () => {
	test('Single job', async () => {
		const task: Message = new DataMessage({ msg: 'hu' })

		return new Promise<void>(resolve => {
			const q = new FastPriorityQueue<Message>(
				async (job: Message) => {
					expect(job).toBe(task)
					resolve()
				},
				{},
				'test'
			)

			q.push(task)
		})
	})

	test('processes multiple jobs sequentially', async () => {
		const order: string[] = []
		const task1: Message = new DataMessage({ msg: '1' })
		const task2: Message = new DataMessage({ msg: '2' })
		const task3: Message = new DataMessage({ msg: '3' })

		return new Promise<void>(resolve => {
			let processedCount = 0
			const q = new FastPriorityQueue<Message>(
				async (job: Message) => {
					order.push((job as DataMessage).getInput(['msg']).msg)
					processedCount++
					if (processedCount === 3) {
						// All should be processed in FIFO order
						expect(order).toEqual(['1', '2', '3'])
						resolve()
					}
				},
				{ concurrency: 1 },
				'test'
			)

			q.push(task1)
			q.push(task2)
			q.push(task3)
		})
	})

	test('handles array push', async () => {
		const processed: Message[] = []
		const task1: Message = new DataMessage({ msg: '1' })
		const task2: Message = new DataMessage({ msg: '2' })

		return new Promise<void>(resolve => {
			const q = new FastPriorityQueue<Message>(
				async (job: Message) => {
					processed.push(job)
					if (processed.length === 2) {
						expect(processed).toContain(task1)
						expect(processed).toContain(task2)
						resolve()
					}
				},
				{},
				'test'
			)

			q.push([task1, task2])
		})
	})

	test('has correct target property', () => {
		const q = new FastPriorityQueue<Message>(async () => {}, {}, 'myTarget')
		expect(q.target).toBe('myTarget')
	})

	test('emits task_finish event with elapsed time', async () => {
		const task: Message = new DataMessage({ msg: 'test' })
		const finishHandler = jest.fn()

		return new Promise<void>(resolve => {
			const q = new FastPriorityQueue<Message>(
				async () => {
					// Simulate some work
					await new Promise(r => setTimeout(r, 20))
				},
				{},
				'test'
			)

			q.on('task_finish', (_, __, stats) => {
				finishHandler(stats)
				expect(stats).toHaveProperty('elapsed')
				// Use a lower threshold to account for timing variations
				expect(stats.elapsed).toBeGreaterThanOrEqual(15)
				resolve()
			})

			q.push(task)
		})
	})

	test('respects priority ordering', async () => {
		const order: number[] = []
		let firstItemProcessing = false
		let continueProcessing: (() => void) | null = null

		return new Promise<void>(resolve => {
			let processedCount = 0
			const q = new FastPriorityQueue<Message>(
				async (job: Message) => {
					// For the first item, wait until all other items are queued
					if (!firstItemProcessing) {
						firstItemProcessing = true
						// Wait for signal that all items are queued
						await new Promise<void>(r => {
							continueProcessing = r
						})
					}
					order.push((job as DataMessage).getInput(['priority']).priority)
					processedCount++
					if (processedCount === 3) {
						// First item processed was priority 1 (already started)
						// Remaining items should be processed in priority order: 10, then 5
						expect(order).toEqual([1, 10, 5])
						resolve()
					}
				},
				{ concurrency: 1 },
				'test'
			)

			// Push first item - this will start processing but block
			q.push(new DataMessage({ priority: 1 }), 1)

			// These get queued while the first item is "processing"
			q.push(new DataMessage({ priority: 10 }), 10)
			q.push(new DataMessage({ priority: 5 }), 5)

			// Now allow the first item to complete, which triggers priority-ordered processing
			setTimeout(() => {
				if (continueProcessing) {
					continueProcessing()
				}
			}, 10)
		})
	})
})

describe('FastPriorityQueue source property', () => {
	test('source can be set once', () => {
		const q = new FastPriorityQueue<Message>(async () => {}, {}, 'test')

		expect(q.source).toBeUndefined()
		q.source = 'mySource'
		expect(q.source).toBe('mySource')
	})

	test('source throws on second set', () => {
		const q = new FastPriorityQueue<Message>(async () => {}, {}, 'test')

		q.source = 'first'
		expect(() => {
			q.source = 'second'
		}).toThrow(TypeError)
	})
})

// FastPriorityBatchQueue tests - mirrors the MemoryPriorityBatchQueue tests for API compatibility
describe('FastPriorityBatchQueue', () => {
	test('Batch job', async () => {
		const task1: Message = new DataMessage({ msg: 'hu' })
		const task2: Message = new DataMessage({ msg: 'gu' })
		const task3: Message = new DataMessage({ msg: 'fu' })

		expect.assertions(2)
		return new Promise<void>(resolve => {
			const q = new FastPriorityBatchQueue<Message>(
				async (jobs: Message[]) => {
					expect([[task1, task2], [task3]]).toContainEqual(jobs)
				},
				{
					batch: {
						size: 2,
						waitMs: 300
					}
				},
				'test'
			)

			q.push([task1, task2])
			setTimeout(() => q.push([task3]), 350)
			// Allow extra time for the second batch timer to fire (350 + 300 + buffer)
			setTimeout(() => resolve(), 700)
		})
	})

	test('batches up to maxSize', async () => {
		const batches: Message[][] = []

		return new Promise<void>(resolve => {
			const q = new FastPriorityBatchQueue<Message>(
				async (jobs: Message[]) => {
					batches.push(jobs)
					if (batches.length === 2) {
						// First batch should be full (size 3)
						expect(batches[0]).toHaveLength(3)
						// Second batch should have remaining
						expect(batches[1]).toHaveLength(1)
						resolve()
					}
				},
				{
					batch: {
						size: 3,
						waitMs: 100
					}
				},
				'test'
			)

			// Push 4 messages - should create 2 batches
			for (let i = 0; i < 4; i++) {
				q.push(new DataMessage({ idx: i }))
			}
		})
	})

	test('has correct target property', () => {
		const q = new FastPriorityBatchQueue<Message>(
			async () => {},
			{ batch: { size: 5, waitMs: 100 } },
			'batchTarget'
		)
		expect(q.target).toBe('batchTarget')
	})

	test('emits task_finish event for batches', async () => {
		const finishHandler = jest.fn()

		return new Promise<void>(resolve => {
			const q = new FastPriorityBatchQueue<Message>(
				async () => {
					await new Promise(r => setTimeout(r, 10))
				},
				{
					batch: {
						size: 2,
						waitMs: 50
					}
				},
				'test'
			)

			q.on('task_finish', (_, __, stats) => {
				finishHandler(stats)
				expect(stats).toHaveProperty('elapsed')
				resolve()
			})

			q.push(new DataMessage({ msg: '1' }))
			q.push(new DataMessage({ msg: '2' }))
		})
	})
})
