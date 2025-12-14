import { EventEmitter } from 'events'
import type { PriorityQueueI } from './PriorityQueueI'
import type { Message } from '../Message'
import { BinaryHeap } from './BinaryHeap'
import { qTrace } from '../stats'
import Debug from 'debug'

const debug = Debug('bakeryjs:fastqueue')
const DEFAULT_PRIORITY = 0

/**
 * Configuration for single-item processing queue
 */
export interface FastQueueConfig {
	/** Maximum concurrent workers (default: 1) */
	concurrency?: number
}

/**
 * Configuration for batch processing queue
 */
export interface FastBatchQueueConfig extends FastQueueConfig {
	batch: {
		/** Maximum items per batch */
		size: number
		/** Milliseconds to wait for batch to fill */
		waitMs: number
	}
}

/**
 * Statistics emitted with task_finish event
 */
export interface TaskFinishStats {
	/** Time elapsed processing the task in milliseconds */
	elapsed: number
}

/**
 * Worker function for single-item processing
 */
type Worker<T> = (task: T) => Promise<void>

/**
 * Worker function for batch processing
 */
type BatchWorker<T> = (tasks: T[]) => Promise<void>

/**
 * Base class for fast priority queues.
 * Provides common functionality for source/target management and event emission.
 * @internal
 */
abstract class FastQueueBase<T extends Message> extends EventEmitter implements PriorityQueueI<T> {
	public readonly target: string
	protected _source: string | undefined
	protected readonly heap: BinaryHeap<T>
	protected activeWorkers: number = 0
	protected readonly maxConcurrency: number

	public constructor(config: FastQueueConfig, target: string) {
		super()
		this.target = target
		this.maxConcurrency = config.concurrency ?? 1
		this.heap = new BinaryHeap<T>()
	}

	/**
	 * Current number of items in the queue (not including active workers)
	 */
	public get length(): number {
		return this.heap.size
	}

	public get source(): string | undefined {
		return this._source
	}

	public set source(value: string | undefined) {
		if (this._source !== undefined) {
			throw new TypeError('The attribute source is already set!')
		}
		this._source = value
	}

	/**
	 * Emit task_finish event with timing stats
	 * @internal
	 */
	protected emitTaskFinish(startTime: number): void {
		const elapsed = Date.now() - startTime
		this.emit('task_finish', null, null, { elapsed })
	}

	/**
	 * Try to process next item(s) if workers are available
	 * @internal
	 */
	protected abstract tryProcessNext(): void

	/**
	 * Add one or more messages to the queue.
	 * Must be implemented by subclasses.
	 */
	public abstract push(message: T | T[], priority?: number): void
}

/**
 * High-performance priority queue with O(log n) operations.
 *
 * Replaces better-queue's MemoryStore which has O(n log n) per insert.
 * Uses a binary max-heap internally with insertion order for FIFO
 * within the same priority level.
 *
 * @emits task_finish - When a task completes processing
 */
export class FastPriorityQueue<T extends Message>
	extends FastQueueBase<T>
	implements PriorityQueueI<T>
{
	private readonly worker: Worker<T>

	public constructor(worker: Worker<T>, config: FastQueueConfig, target: string) {
		super(config, target)
		this.worker = worker
	}

	/**
	 * Add one or more messages to the queue.
	 * Complexity: O(log n) per message
	 */
	@qTrace(true)
	public push(message: T | T[], priority?: number): void {
		const effectivePriority = priority ?? DEFAULT_PRIORITY

		if (Array.isArray(message)) {
			for (const msg of message) {
				this.heap.insert(msg, effectivePriority)
			}
		} else {
			this.heap.insert(message, effectivePriority)
		}

		this.tryProcessNext()
	}

	/**
	 * Try to process next item if workers are available
	 * @internal
	 */
	protected tryProcessNext(): void {
		while (this.activeWorkers < this.maxConcurrency && !this.heap.isEmpty) {
			const item = this.heap.extractMax()
			if (item === undefined) {
				break
			}

			this.activeWorkers++
			const startTime = Date.now()
			debug('Processing item in queue %s, activeWorkers: %d', this.target, this.activeWorkers)

			Promise.resolve()
				.then(() => this.worker(item))
				.then(
					() => {
						debug('Worker completed successfully in queue %s', this.target)
					},
					(err: unknown) => {
						debug('Worker failed in queue %s: %s', this.target, err)
						// Error handling is done by the worker itself
					}
				)
				.finally(() => {
					this.activeWorkers--
					this.emitTaskFinish(startTime)
					debug('Task finished in queue %s, activeWorkers: %d', this.target, this.activeWorkers)
					this.tryProcessNext()
				})
		}
	}
}

/**
 * Batch variant of FastPriorityQueue.
 *
 * Accumulates items and processes them in batches based on:
 * - Maximum batch size
 * - Batch timeout (processes partial batch after timeout)
 *
 * @emits task_finish - When a batch completes processing
 */
export class FastPriorityBatchQueue<T extends Message>
	extends FastQueueBase<T>
	implements PriorityQueueI<T>
{
	private readonly worker: BatchWorker<T>
	private readonly batchSize: number
	private readonly batchWaitMs: number
	private batchTimer: ReturnType<typeof setTimeout> | null = null

	public constructor(worker: BatchWorker<T>, config: FastBatchQueueConfig, target: string) {
		super(config, target)
		this.worker = worker
		this.batchSize = config.batch.size
		this.batchWaitMs = config.batch.waitMs
	}

	/**
	 * Add one or more messages to the queue.
	 * Complexity: O(log n) per message
	 */
	@qTrace(true)
	public push(message: T | T[], priority?: number): void {
		const effectivePriority = priority ?? DEFAULT_PRIORITY

		if (Array.isArray(message)) {
			for (const msg of message) {
				this.heap.insert(msg, effectivePriority)
			}
		} else {
			this.heap.insert(message, effectivePriority)
		}

		this.scheduleBatch()
	}

	/**
	 * Schedule batch processing.
	 * Immediately processes if we have a full batch, otherwise sets a timer.
	 * @internal
	 */
	private scheduleBatch(): void {
		// If we have enough items for a full batch, process immediately
		if (this.heap.size >= this.batchSize && this.activeWorkers < this.maxConcurrency) {
			this.clearBatchTimer()
			this.tryProcessNext()
			return
		}

		// Otherwise, set a timer to process partial batch
		if (this.batchTimer === null && this.heap.size > 0) {
			this.batchTimer = setTimeout(() => {
				this.batchTimer = null
				this.tryProcessNext()
			}, this.batchWaitMs)
		}
	}

	/**
	 * Clear the batch timer if it exists
	 * @internal
	 */
	private clearBatchTimer(): void {
		if (this.batchTimer !== null) {
			clearTimeout(this.batchTimer)
			this.batchTimer = null
		}
	}

	/**
	 * Try to process next batch if workers are available
	 * @internal
	 */
	protected tryProcessNext(): void {
		while (this.activeWorkers < this.maxConcurrency && !this.heap.isEmpty) {
			// Extract up to batchSize items
			const batch = this.heap.extractN(this.batchSize)
			if (batch.length === 0) {
				break
			}

			this.activeWorkers++
			const startTime = Date.now()
			debug(
				'Processing batch of %d items in queue %s, activeWorkers: %d',
				batch.length,
				this.target,
				this.activeWorkers
			)

			Promise.resolve()
				.then(() => this.worker(batch))
				.then(
					() => {
						debug('Batch worker completed successfully in queue %s', this.target)
					},
					(err: unknown) => {
						debug('Batch worker failed in queue %s: %s', this.target, err)
						// Error handling is done by the worker itself
					}
				)
				.finally(() => {
					this.activeWorkers--
					this.emitTaskFinish(startTime)
					debug(
						'Batch task finished in queue %s, activeWorkers: %d',
						this.target,
						this.activeWorkers
					)
					// Schedule next batch processing
					if (!this.heap.isEmpty) {
						this.scheduleBatch()
					}
				})

			// Clear the timer since we just processed
			this.clearBatchTimer()

			// Re-check if we should schedule another batch
			if (!this.heap.isEmpty && this.activeWorkers >= this.maxConcurrency) {
				this.scheduleBatch()
				break
			}
		}
	}
}
