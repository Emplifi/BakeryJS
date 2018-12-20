import {boxFactory, ServiceProvider, MessageData} from 'bakeryjs';

module.exports = boxFactory(
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
