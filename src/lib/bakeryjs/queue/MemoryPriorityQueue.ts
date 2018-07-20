import {AsyncPriorityQueue, priorityQueue} from 'async';
import {IPriorityQueue} from './IPriorityQueue';
import {Message} from '../Message';

export class MemoryPriorityQueue<T extends Message>
	implements IPriorityQueue<T> {
	private readonly queue: AsyncPriorityQueue<T>;

	public constructor(
		worker: (task: T) => Promise<void> | void,
		concurrency: number
	) {
		this.queue = priorityQueue(worker, concurrency);
	}

	public push(message: T, priority?: number): void {
		this.queue.push(message, priority || 5);
	}
}
