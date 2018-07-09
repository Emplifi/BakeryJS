import {Box} from '../../../lib/bakeryjs/Box';
import {IPriorityQueue} from '../../../lib/bakeryjs/queue/IPriorityQueue';
import {Message, MessageData} from '../../../lib/bakeryjs/Message';
import {ServiceProvider} from '../../../lib/bakeryjs/ServiceProvider';

class Tick extends Box<MessageData, MessageData, MessageData> {
	constructor(name: string, queue: IPriorityQueue<Message>) {
		super(name, {
			requires: ['jobId'],
			provides: ['tick'],
			emits: ['raw'],
		}, queue);
    }

	protected async processValue(value: MessageData, chunkCallback: (chunk: MessageData, priority: number) => void): Promise<MessageData> {
		let i: number = 0;
		return new Promise((resolve: (result: MessageData) => void): void => {
			const id = setInterval((): void => {
				if (i >= 3) {
					clearInterval(id);
					resolve({tick: i});
				}
				i += 1;
				chunkCallback({raw: i}, 1);
			}, 1000);
		});
	}
}

export default (name: string, serviceProvider: ServiceProvider, queue: IPriorityQueue<Message>): Tick => {
	return new Tick(name, queue);
};
