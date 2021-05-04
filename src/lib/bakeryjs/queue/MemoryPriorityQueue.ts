import {PriorityQueueI} from './PriorityQueueI';
import {Message} from '../Message';
import {qTrace} from '../stats';
// import {qTrace, sampleStats} from '../stats';
import BetterQueue = require('better-queue');
import FastQ = require('fastq');

const DEFAULT_PRIORITY = undefined;

type TaskWrap<T> = {
	m: T;
	p: number;
};

export interface QueueConfig {
	concurrency?: number;
}
export interface BatchQueueConfig extends QueueConfig {
	batch: {
		size: number;
		waitms: number;
	};
}

type Worker<T> = (task: T) => Promise<void>;
type BatchWorker<T> = (task: T[]) => Promise<void>;

// @sampleStats
export class AQueue<T extends Message> implements PriorityQueueI<T> {
	private src: string | undefined;
	protected readonly queue: BetterQueue<any, any>;
	public readonly target: string;

	public constructor(
		target: string,
		worker: (j: any, cb: (e: any, v: any) => void) => void,
		config: Partial<BetterQueue.QueueOptions<any, any>>
	) {
		this.target = target;
		this.queue = new BetterQueue(worker, config);
	}

	@qTrace(true)
	public push(message: T | T[], priority = DEFAULT_PRIORITY): void {
		//TODO Fragile detection. What if T is subclass/instance of Array?
		if (Array.isArray(message)) {
			for (let i = 0; i < message.length; i++) {
				this.queue.push({m: message[i], p: priority});
			}
		} else {
			this.queue.push({m: message, p: priority});
		}
	}

	public get length(): number {
		const len: number = this.queue.getStats().peak;
		this.queue.resetStats();
		return len;
	}

	public set source(value: string | undefined) {
		if (!this.src) {
			this.src = value;
		} else {
			throw new TypeError('The attribute source is already set!');
		}
	}

	public get source(): string | undefined {
		return this.src;
	}
}

class FastAQueue<T extends Message> implements PriorityQueueI<T> {
	private src: string | undefined;
	protected readonly queue: FastQ.queue;
	public readonly target: string;

	public constructor(
		target: string,
		worker: (j: any, cb: (e: any, v: any) => void) => void,
		config: Partial<BetterQueue.QueueOptions<any, any>>
	) {
		this.target = target;
		this.queue = FastQ(worker, config.concurrent || 1);
	}

	@qTrace(true)
	public push(message: T | T[], priority = DEFAULT_PRIORITY): void {
		if (Array.isArray(message)) {
			for (let i = 0; i < message.length; i++) {
				this.queue.push({m: message[i], p: priority});
			}
		} else {
			this.queue.push({m: message, p: priority});
		}
	}

	public get length(): number {
		console.log('getting length', this.queue.length())
		return this.queue.length();
	}

	public set source(value: string | undefined) {
		if (!this.src) {
			this.src = value;
		} else {
			throw new TypeError('The attribute source is already set!');
		}
	}

	public get source(): string | undefined {
		return this.src;
	}
}

export class MemoryPrioritySingleQueue<T extends Message>
	extends FastAQueue<T>
	implements PriorityQueueI<T> {
	public constructor(worker: Worker<T>, config: QueueConfig, target: string) {
		super(
			target,
			(task: TaskWrap<T>, cb) =>
				// TODO? The push to the other queue is part of the task itself
				// Would it be much more legible, if the push would take part
				// outside of the task (here)?
				worker(task.m).finally(() => cb(undefined, undefined)),
			{
				concurrent: config.concurrency,
				priority: (t, cb) => cb(undefined, t.p),
			}
		);
	}
}

export class MemoryPriorityBatchQueue<T extends Message>
	extends AQueue<T>
	implements PriorityQueueI<T> {
	public constructor(
		worker: BatchWorker<T>,
		config: BatchQueueConfig,
		target: string
	) {
		super(
			target,
			(tasks: TaskWrap<T>[], cb) =>
				// TODO? The push to the other queue is part of the task itself
				// Would it be much more legible, if the push would take part
				// outside of the task (here)?
				worker(tasks.map((t) => t.m)).finally(() =>
					cb(undefined, undefined)
				),
			{
				concurrent: config.concurrency,
				batchSize: config.batch.size,
				batchDelay: config.batch.waitms,
				batchDelayTimeout: config.batch.waitms,
				afterProcessDelay: config.batch.waitms,
				priority: (t, cb) => cb(undefined, t.p),
			}
		);
	}
}
