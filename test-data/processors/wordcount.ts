import {boxFactory} from './../../src';
import {ServiceProvider} from '../../src/lib/bakeryjs/ServiceProvider';
import {MessageData} from '../../src/lib/bakeryjs/Message';

module.exports = boxFactory(
	'wordCount',
	{
		provides: ['words'],
		requires: ['msg'],
		emits: [],
		aggregates: false,
	},
	function(serviceProvider: ServiceProvider, value: MessageData) {
		return {words: (value.msg as string).split(/\W+/).length};
	}
);
