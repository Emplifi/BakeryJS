import {boxFactory, ServiceProvider, MessageData} from './../../src';

module.exports = boxFactory(
	{
		provides: ['msg'],
		requires: [],
		emits: ['msg'],
		aggregates: false,
	},
	async function(
		serviceProvider: ServiceProvider,
		value: MessageData,
		emit: (chunk: MessageData[], priority?: number) => void
	) {
		emit([{msg: 'Hello World!'}]);
		return;
	}
);
