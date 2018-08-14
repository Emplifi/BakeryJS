import {AsyncPriorityQueue, priorityQueue} from 'async';
import {PriorityQueueI} from './PriorityQueueI';
import {Message} from '../Message';

const DEFAULT_PRIORITY = 5;

export class MemoryPriorityQueue<T extends Message>
	implements PriorityQueueI<T> {
	private readonly queue: AsyncPriorityQueue<T>;

	public constructor(
		worker: (task: T) => Promise<void> | void,
		concurrency: number
	) {
		this.queue = priorityQueue(worker, concurrency);
	}

	public push(message: T, priority = DEFAULT_PRIORITY): void {
		this.queue.push(message, priority);
	}
}
