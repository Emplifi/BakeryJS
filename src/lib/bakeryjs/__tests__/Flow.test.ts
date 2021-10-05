import {Flow} from '../Flow';
import {Job} from '../Job';
import {MemoryPrioritySingleQueue} from '../queue/MemoryPriorityQueue';
import {Message} from '../Message';
import {DiGraph} from 'sb-jsnetworkx';

describe('Flow', () => {
	it('enqueues job as a message', () => {
		const queue = new MemoryPrioritySingleQueue(
			(task: Message) => Promise.resolve(),
			{concurrency: 1},
			'__root__'
		);
		const spyOnPush = jest.spyOn(queue, 'push');

		const flow = new Flow(queue, new DiGraph());
		flow.process(new Job());

		expect(spyOnPush).toHaveBeenCalledTimes(1);
	});
});
