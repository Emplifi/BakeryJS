import {boxFactory, ServiceProvider, MessageData} from 'bakeryjs';

module.exports = boxFactory(
	{
		provides: ['msg'],
		requires: [],
		emits: ['msg_helloworld'],
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
