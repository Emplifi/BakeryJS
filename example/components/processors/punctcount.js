const {boxFactory} = require('bakeryjs');

// Processor component which counts punctuations (non-word characters) in a message
module.exports = boxFactory(
	'punctcount',
	{
		provides: ['punct'],
		requires: ['msg'],
		emits: [],
		aggregates: false,
	},
	function(serviceProvider, value) {
		return {punct: value.msg.split(/\w+/).length};
	}
);
