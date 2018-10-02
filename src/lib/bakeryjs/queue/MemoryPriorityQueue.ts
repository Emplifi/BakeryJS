import {AsyncPriorityQueue, priorityQueue} from 'async';
import {PriorityQueueI} from './PriorityQueueI';
import {Message} from '../Message';
import {qTrace, sampleLength} from '../stats';

const DEFAULT_PRIORITY = 5;

@sampleLength
export class MemoryPriorityQueue<T extends Message>
	implements PriorityQueueI<T> {
	private src: string | undefined;
	private readonly queue: AsyncPriorityQueue<T>;
	public readonly target: string;

	public constructor(
		worker: (task: T) => Promise<void> | void,
		concurrency: number,
		target: string
	) {
		this.queue = priorityQueue(worker, concurrency);
		this.target = target;
	}

	@qTrace(true)
	public push(message: T | T[], priority = DEFAULT_PRIORITY): void {
		this.queue.push(message, priority);
	}

	public get length(): number {
		return this.queue.length();
	}

	public set source(value: string | undefined) {
		if (!this.src) {
			this.src = value;
		} else {
			throw TypeError('The attribute source is already set!');
		}
	}

	public get source(): string | undefined {
		return this.src;
	}
}
