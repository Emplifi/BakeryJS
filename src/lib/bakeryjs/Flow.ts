import { AsyncPriorityQueue } from 'async';
import { Job } from './Job';
import { Message } from './Message';

export class Flow {
    private queue: AsyncPriorityQueue<Message>;

    constructor(queue: AsyncPriorityQueue<Message>) {
        this.queue = queue;
    }

    public process(job: Job): void {
        this.queue.push(new Message(job), 1);
    }
}
