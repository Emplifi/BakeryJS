import {boxFactory, ServiceProvider, MessageData} from './../../src';

module.exports = boxFactory(
	{
		provides: ['checksum'],
		requires: ['words', 'punct'],
		emits: [],
		aggregates: false,
		parameters: {
			title: 'Parameter of the box -- positive number',
			type: 'number',
			minimum: 0,
		},
	},
	function(serviceProvider: ServiceProvider, value: MessageData) {
		return {
			checksum:
				Math.sqrt(serviceProvider.parameters || 2) * value.words +
				value.punct,
		};
	}
);
