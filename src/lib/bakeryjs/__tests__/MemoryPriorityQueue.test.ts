import {
	MemoryPriorityBatchQueue,
	MemoryPrioritySingleQueue,
} from '../queue/MemoryPriorityQueue';
import {DataMessage, Message} from '../Message';

test('Single job', async () => {
	const task: Message = new DataMessage({msg: 'hu'});

	return new Promise((resolve) => {
		const q: MemoryPrioritySingleQueue<
			Message
		> = new MemoryPrioritySingleQueue(
			async (job: Message) => {
				expect(job).toBe(task);
				resolve();
			},
			{},
			'test'
		);

		q.push(task);
	});
});

test('Batch job', async () => {
	const task1: Message = new DataMessage({msg: 'hu'});
	const task2: Message = new DataMessage({msg: 'gu'});
	const task3: Message = new DataMessage({msg: 'fu'});

	expect.assertions(2);
	return new Promise((resolve) => {
		const q: MemoryPriorityBatchQueue<
			Message
		> = new MemoryPriorityBatchQueue(
			async (jobs: Message[]) => {
				expect([[task1, task2], [task3]]).toContainEqual(jobs);
			},
			{
				batch: {
					size: 2,
					waitms: 300,
				},
			},
			'test'
		);

		q.push([task1, task2]);
		setTimeout(() => q.push([task3]), 350);
		setTimeout(() => resolve(), 650);
	});
});
