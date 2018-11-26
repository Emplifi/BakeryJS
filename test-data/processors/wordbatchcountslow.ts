import {boxFactory, ServiceProvider, MessageData} from '../../src';

module.exports = boxFactory(
	{
		provides: ['words'],
		requires: ['msg'],
		aggregates: false,
		batch: {
			maxSize: 3,
			timeoutSeconds: 0.1,
		},
	},
	async function(serviceProvider: ServiceProvider, values: MessageData[]) {
		const vals = values.map((value) =>
			Object.create(null, {
				words: {value: (value.msg as string).split(/\W+/).length},
			})
		);
		await new Promise((resolve) => setTimeout(resolve, 1200));
		return vals;
	}
);
