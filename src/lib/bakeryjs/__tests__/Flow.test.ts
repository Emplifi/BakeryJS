import {Flow} from '../Flow';
import {Job} from '../Job';
import {MemoryPriorityQueue} from '../queue/MemoryPriorityQueue';
import {Message} from '../Message';

describe('Flow', () => {
	it('enqueues job as a message', () => {
		const queue = new MemoryPriorityQueue((task: Message) => undefined, 1);
		const spyOnPush = jest.spyOn(queue, 'push');

		const flow = new Flow(queue);
		flow.process(new Job());

		expect(spyOnPush).toHaveBeenCalledTimes(1);
	});
});
