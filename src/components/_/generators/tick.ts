import { Box } from '../../../lib/bakeryjs/Box';
import {Message, MessageData} from '../../../lib/bakeryjs/Message';
import {AsyncPriorityQueue} from 'async';
import {ServiceProvider} from '../../../lib/bakeryjs/ServiceProvider';

class Tick extends Box<MessageData, MessageData, MessageData> {
	meta = {
		requires: ['job'],
		provides: ['tick'],
	};

	constructor(name: string, queue: AsyncPriorityQueue<MessageData>) {
		super(name, queue);
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
				chunkCallback(new Message({raw: i}), 1);
			}, 1000);
		});
	}
}

export default (name: string, serviceProvider: ServiceProvider, queue: AsyncPriorityQueue<MessageData>): Tick => {
	return new Tick(name, queue);
};
