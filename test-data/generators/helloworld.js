const {boxFactory} = require('./../../src');

module.exports = boxFactory(
	'helloWorld',
	{
		provides: ['msg'],
		requires: [],
		emits: [],
		aggregates: false,
	},
	function(serviceProvider, value) {
		return {msg: 'Hello World!'};
	}
);
