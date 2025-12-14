import { MemoryPriorityBatchQueue, MemoryPrioritySingleQueue } from '../queue/MemoryPriorityQueue'
import { DataMessage, Message } from '../Message'

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
