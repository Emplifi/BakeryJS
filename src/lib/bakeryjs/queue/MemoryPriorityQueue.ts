import {AsyncPriorityQueue} from 'async';
import {IPriorityQueue, MessageMetadata} from './IPriorityQueue';
import {Message} from '../Message';
import {priorityQueue} from 'async';

export class MemoryPriorityQueue<T extends Message> implements IPriorityQueue<T> {
    private readonly queue: AsyncPriorityQueue<T>;

    public constructor(worker: (task: T) => (Promise<void> | void), concurrency: number) {
        this.queue = priorityQueue(worker, concurrency);
    }

	public push(message: T, metadata: MessageMetadata): void {
        this.queue.push(message, metadata.priority);
    }

	public pushingFinished(jobId: string): void {
    }

	public setJobFinishedCallback(jobId: string, callback: () => (Promise<void> | void)): void {
    }

	public setJobMessageFailedCallback(jobId: string, callback: (error: Error) => (Promise<void> | void)): void {
    }
}
