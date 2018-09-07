const {boxFactory} = require(`${__dirname}/../../build/lib/bakeryjs/Box`);

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