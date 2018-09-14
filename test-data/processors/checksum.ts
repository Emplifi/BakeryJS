import {boxFactory} from './../../src';
import {ServiceProvider} from '../../src/lib/bakeryjs/ServiceProvider';
import {MessageData} from '../../src/lib/bakeryjs/Message';

module.exports = boxFactory(
	'checksum',
	{
		provides: ['checksum'],
		requires: ['words', 'punct'],
		emits: [],
		aggregates: false,
	},
	function(serviceProvider: ServiceProvider, value: MessageData) {
		return {checksum: Math.sqrt(2) * value.words + value.punct};
	}
);
