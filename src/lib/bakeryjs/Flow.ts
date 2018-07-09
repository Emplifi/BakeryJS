import {IPriorityQueue} from './queue/IPriorityQueue';
import {Job} from './Job';
import {Message} from './Message';

export class Flow {
    private queue: IPriorityQueue<Message>;

    constructor(queue: IPriorityQueue<Message>) {
        this.queue = queue;
    }

    public process(job: Job): void {
        this.queue.push(new Message(job), {
            priority: 1,
        });
    }
}
