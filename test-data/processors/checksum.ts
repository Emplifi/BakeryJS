import {boxFactory} from './../../src';
import {ServiceProvider} from '../../src/lib/bakeryjs/ServiceProvider';
import {MessageData} from '../../src/lib/bakeryjs/Message';

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
