import {boxFactory} from '../../../lib/bakeryjs/Box';
import {MessageData} from '../../../lib/bakeryjs/Message';
import {ServiceProvider} from '../../../lib/bakeryjs/ServiceProvider';

const Tick = boxFactory(
	'tick',
	{
		requires: ['jobId'],
		provides: ['raw'],
		emits: ['tick'],
		aggregates: false,
	},
	function processValue(
		serviceProvider: ServiceProvider,
		value: MessageData,
		emitCallback: (chunk: MessageData[], priority?: number) => void
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
					emitCallback([{raw: i}], 1);
				}, 1000);
			}
		);
	}
);

export default Tick;
