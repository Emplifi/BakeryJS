import {boxFactory, ServiceProvider, MessageData} from 'bakeryjs';

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
		const param = (serviceProvider.parameters as number | undefined) ?? 2;
		return {
			checksum:
				Math.sqrt(param) * (value.words as number) +
				(value.punct as number),
		};
	}
);
