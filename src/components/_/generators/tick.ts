import { Box } from '../../../lib/bakeryjs/Box';
import {Message, MessageData} from '../../../lib/bakeryjs/Message';

class Tick extends Box<MessageData, MessageData> {
	meta = {
		requires: ['job'],
		provides: ['tick'],
	};

	constructor(name: string) {
		super(name);
    }

	public async process(input: MessageData): Promise<MessageData> {
		let i: number = 0;
		return new Promise((resolve: (result: MessageData) => void): void => {
			const id = setInterval((): void => {
				if (i >= 3) {
					clearInterval(id);
					resolve({tick: i});
				}
				i += 1;
				if (this.queue != null) {
					this.queue.push(new Message({raw: i}), 1);
                }
			}, 1000);
		});
	}
}

export default (name: string): Tick => {
	return new Tick(name);
};
