import {boxFactory} from './../../src';
import {ServiceProvider} from '../../src/lib/bakeryjs/ServiceProvider';
import {MessageData} from '../../src/lib/bakeryjs/Message';

module.exports = boxFactory(
	'helloWorld',
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
