import {Box} from '../../../lib/bakeryjs/Box';
import {PriorityQueueI} from '../../../lib/bakeryjs/queue/PriorityQueueI';
import {Message, MessageData} from '../../../lib/bakeryjs/Message';
import {ServiceProvider} from '../../../lib/bakeryjs/ServiceProvider';

class Tick extends Box {
	public constructor(name: string, queue: PriorityQueueI<Message>) {
		super(
			name,
			{
				requires: ['jobId'],
				provides: ['raw'],
				emits: ['tick'],
				aggregates: false,
			},
			queue
		);
	}

	protected async processValue(
		value: MessageData,
		emitCallback: (chunk: MessageData, priority: number) => void
	): Promise<any> {
		let i = 0;
		return new Promise(
			(resolve: (result?: any) => void): void => {
				const id = setInterval((): void => {
					if (i >= 3) {
						clearInterval(id);
						resolve();
					}
					i += 1;
					emitCallback({raw: i}, 1);
				}, 1000);
			}
		);
	}
}

export default (
	name: string,
	serviceProvider: ServiceProvider,
	queue: PriorityQueueI<Message>
): Tick => {
	return new Tick(name, queue);
};
