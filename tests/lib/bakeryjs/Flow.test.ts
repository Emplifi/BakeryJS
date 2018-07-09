import {Flow} from '../../../src/lib/bakeryjs/Flow';
import {Job} from '../../../src/lib/bakeryjs/Job';
import {MemoryPriorityQueue} from '../../../src/lib/bakeryjs/queue/MemoryPriorityQueue';
import {Message} from '../../../src/lib/bakeryjs/Message';

describe('Flow', () => {
    it('enqueues job as a message', () => {
        const queue = new MemoryPriorityQueue((task: Message) => task, 1);
        const spyOnPush = jest.spyOn(queue, 'push');

        const flow = new Flow(queue);
        flow.process(new Job());

        expect(spyOnPush).toHaveBeenCalledTimes(1);
    });
});
