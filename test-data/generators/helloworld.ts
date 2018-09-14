import {boxFactory} from './../../src';
import {ServiceProvider} from '../../src/lib/bakeryjs/ServiceProvider';
import {MessageData} from '../../src/lib/bakeryjs/Message';

module.exports = boxFactory(
	'helloWorld',
	{
		provides: ['msg'],
		requires: [],
		emits: [],
		aggregates: false,
	},
	function(serviceProvider: ServiceProvider, value: MessageData) {
		return {msg: 'Hello World!'};
	}
);
