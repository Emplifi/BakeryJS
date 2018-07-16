import {IPriorityQueue} from './queue/IPriorityQueue';
import {Job} from './Job';
import {Message} from './Message';

export class Flow {
    private queue: IPriorityQueue<Message>;

    public constructor(queue: IPriorityQueue<Message>) {
        this.queue = queue;
    }

    public process(job: Job): void {
        const message = new Message(job);
        this.queue.push(message, {
            jobId: job.jobId,
            priority: 1,
        });
    }
}
