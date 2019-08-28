import {boxFactory, ServiceProvider, MessageData} from '../../..';

const Tock = boxFactory(
	{
		requires: ['jobId'],
		provides: ['raw'],
		emits: ['tock'],
		aggregates: false,
	},
	function processValue(
		serviceProvider: ServiceProvider,
		value: MessageData,
		emitCallback: (chunk: MessageData[], priority?: number) => void
	): Promise<any> {
		let i = 0;
		return new Promise((resolve: (result?: any) => void): void => {
			const id = setInterval((): void => {
				if (i >= 3) {
					clearInterval(id);
					resolve();
				}
				i += 1;
				emitCallback([{raw: i}], 1);
			}, 1000);
		});
	}
);

export default Tock;
