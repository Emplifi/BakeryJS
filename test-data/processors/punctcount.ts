import {boxFactory, ServiceProvider, MessageData} from './../../src';

module.exports = boxFactory(
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
