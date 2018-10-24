const {boxFactory} = require('bakeryjs');

// Processor component which calculates "checksum" for a given message from number of words and punctuations
module.exports = boxFactory(
	'checksum',
	{
		provides: ['checksum'],
		requires: ['words', 'punct'],
		emits: [],
		aggregates: false,
	},
	function(serviceProvider, value) {
		return {checksum: Math.sqrt(2) * value.words + value.punct};
	}
);
