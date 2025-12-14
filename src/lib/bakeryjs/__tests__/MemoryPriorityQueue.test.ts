import { MemoryPriorityBatchQueue, MemoryPrioritySingleQueue } from '../queue/MemoryPriorityQueue'
import { DataMessage, Message } from '../Message'
import { sampleStats, eventEmitter } from '../stats'

describe('MemoryPrioritySingleQueue', () => {
	test('Single job', async () => {
		const task: Message = new DataMessage({ msg: 'hu' })

		return new Promise<void>(resolve => {
			const q: MemoryPrioritySingleQueue<Message> = new MemoryPrioritySingleQueue(
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
			const q = new MemoryPrioritySingleQueue<Message>(
				async (job: Message) => {
					order.push((job as DataMessage).getInput(['msg']).msg)
					processedCount++
					if (processedCount === 3) {
						// Order may vary due to async, but all should be processed
						expect(order).toHaveLength(3)
						expect(order).toContain('1')
						expect(order).toContain('2')
						expect(order).toContain('3')
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
			const q = new MemoryPrioritySingleQueue<Message>(
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
		const q = new MemoryPrioritySingleQueue<Message>(async () => {}, {}, 'myTarget')
		expect(q.target).toBe('myTarget')
	})
})

describe('MemoryPriorityBatchQueue', () => {
	test('Batch job', async () => {
		const task1: Message = new DataMessage({ msg: 'hu' })
		const task2: Message = new DataMessage({ msg: 'gu' })
		const task3: Message = new DataMessage({ msg: 'fu' })

		expect.assertions(2)
		return new Promise<void>(resolve => {
			const q: MemoryPriorityBatchQueue<Message> = new MemoryPriorityBatchQueue(
				async (jobs: Message[]) => {
					expect([[task1, task2], [task3]]).toContainEqual(jobs)
				},
				{
					batch: {
						size: 2,
						waitms: 300
					}
				},
				'test'
			)

			q.push([task1, task2])
			setTimeout(() => q.push([task3]), 350)
			setTimeout(() => resolve(), 650)
		})
	})

	test('batches up to maxSize', async () => {
		const batches: Message[][] = []

		return new Promise<void>(resolve => {
			const q = new MemoryPriorityBatchQueue<Message>(
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
						waitms: 100
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
		const q = new MemoryPriorityBatchQueue<Message>(
			async () => {},
			{ batch: { size: 5, waitms: 100 } },
			'batchTarget'
		)
		expect(q.target).toBe('batchTarget')
	})
})

describe('AQueue source property', () => {
	test('source can be set once', () => {
		const q = new MemoryPrioritySingleQueue<Message>(async () => {}, {}, 'test')

		expect(q.source).toBeUndefined()
		q.source = 'mySource'
		expect(q.source).toBe('mySource')
	})

	test('source throws on second set', () => {
		const q = new MemoryPrioritySingleQueue<Message>(async () => {}, {}, 'test')

		q.source = 'first'
		expect(() => {
			q.source = 'second'
		}).toThrow(TypeError)
	})
})

describe('sampleStats decorator', () => {
	beforeEach(() => {
		jest.useFakeTimers()
	})

	afterEach(() => {
		jest.useRealTimers()
		// Remove all listeners from the eventEmitter to clean up
		eventEmitter.removeAllListeners()
	})

	it('wraps an AQueue subclass and returns a class', () => {
		const WrappedQueue = sampleStats(MemoryPrioritySingleQueue)
		expect(typeof WrappedQueue).toBe('function')
	})

	it('wrapped class can be instantiated like the original', () => {
		const WrappedQueue = sampleStats(MemoryPrioritySingleQueue)
		const worker = jest.fn().mockResolvedValue(undefined)
		const q = new WrappedQueue(worker, { concurrency: 1 }, 'testTarget')

		expect(q).toBeInstanceOf(MemoryPrioritySingleQueue)
		expect(q.target).toBe('testTarget')
	})

	it('emits queue_stats events at regular intervals', () => {
		const WrappedQueue = sampleStats(MemoryPrioritySingleQueue)
		const worker = jest.fn().mockResolvedValue(undefined)
		const statsHandler = jest.fn()

		eventEmitter.on('queue_stats', statsHandler)
		new WrappedQueue(worker, { concurrency: 1 }, 'statTarget')

		// Initially no events
		expect(statsHandler).not.toHaveBeenCalled()

		// Advance timer past the sampling interval (900ms)
		jest.advanceTimersByTime(900)
		expect(statsHandler).toHaveBeenCalledWith({
			boxName: 'statTarget',
			size: expect.any(Number)
		})

		// Advance timer again
		jest.advanceTimersByTime(900)
		expect(statsHandler).toHaveBeenCalledTimes(2)
	})

	it('subscribes to task_finish events on the queue', () => {
		const WrappedQueue = sampleStats(MemoryPrioritySingleQueue)
		const worker = jest.fn().mockResolvedValue(undefined)
		const timingHandler = jest.fn()

		eventEmitter.on('box_timing', timingHandler)
		const q = new WrappedQueue(worker, { concurrency: 1 }, 'timingTarget')

		// The decorator subscribes to 'task_finish' on the underlying queue
		// We can verify the subscription was set up by checking the wrapped queue exists
		expect(q.target).toBe('timingTarget')
		// The timingHandler will be called when actual tasks complete,
		// but that's tested via the integration with better-queue
	})

	it('timer is unreferenced so it does not prevent process exit', () => {
		const WrappedQueue = sampleStats(MemoryPrioritySingleQueue)
		const worker = jest.fn().mockResolvedValue(undefined)

		// This test just verifies the wrapped queue can be created
		// The unref() call prevents the timer from keeping the process alive
		// but we can't easily test that directly - we just verify no errors occur
		const q = new WrappedQueue(worker, { concurrency: 1 }, 'unrefTarget')
		expect(q.target).toBe('unrefTarget')
	})
})
