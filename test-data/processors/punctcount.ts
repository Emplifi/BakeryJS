import {boxFactory} from './../../src';
import {ServiceProvider} from '../../src/lib/bakeryjs/ServiceProvider';
import {MessageData} from '../../src/lib/bakeryjs/Message';

module.exports = boxFactory(
	'punctCount',
	{
		provides: ['punct'],
		requires: ['msg'],
		emits: [],
		aggregates: false,
	},
	function(serviceProvider: ServiceProvider, value: MessageData) {
		return {punct: (value.msg as string).split(/\w+/).length};
	}
);
