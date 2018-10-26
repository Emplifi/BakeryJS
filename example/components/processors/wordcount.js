const {boxFactory} = require('bakeryjs');

// Processor component which calculates number of words in a message
module.exports = boxFactory(
	'wordcount',
	{
		provides: ['words'],
		requires: ['msg'],
		emits: [],
		aggregates: false,
	},
	// serviceParamsProvider may contain some shared modules, like logger
	// second parameter is an object with properties corresponding to 'requires'
	function(serviceProvider, {msg}) {
		return {words: msg.split(/\W+/).length};
	}
);
