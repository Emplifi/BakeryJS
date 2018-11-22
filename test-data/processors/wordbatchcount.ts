import {boxFactory, ServiceProvider, MessageData} from '../../src';

module.exports = boxFactory(
	{
		provides: ['words'],
		requires: ['msg'],
		aggregates: false,
		batch: {
			maxSize: 3,
			timeoutSeconds: 0.3,
		},
	},
	async function(serviceProvider: ServiceProvider, values: MessageData[]) {
		return values.map((value) =>
			Object.create(null, {
				words: {value: (value.msg as string).split(/\W+/).length},
			})
		);
	}
);
