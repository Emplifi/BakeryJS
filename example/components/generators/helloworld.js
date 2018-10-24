const {boxFactory} = require('bakeryjs');
const {promisify} = require('util');

const timeout = promisify(setTimeout);

// boxFactory creates a component,
// it must be the default export of the module
module.exports = boxFactory(
	// Name of component; this is referenced in the data flow description
	'helloworld',
	// Component's metadata
	{
		provides: ['msg'], // What kind of data this component provides?
		requires: [], // What kind of data this component requires to work?
		emits: ['msg'], // This component can emit multiple messages at once, which must be reflected in this property
		aggregates: false, // Whether the component can aggregate multiple messages
	},
	// Logic of the component, can be async function which emits data over time
	async function(serviceProvider, value, emit) {
		// Each message is an object with key corresponding to 'emits' property in metadata
		emit([{msg: 'Hello world!'}]);
		await timeout(230);
		// Component can emit multiple messages at once
		emit([{msg: '¡Hola mundo!'}, {msg: 'Ahoj světe!'}]);
		await timeout(150);
		emit([{msg: 'Hallo Welt!'}, {msg: 'Bonjour monde!'}]);
		await timeout(200);
	}
);
