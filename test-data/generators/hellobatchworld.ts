import {boxFactory} from './../../src';
import {ServiceProvider} from '../../src/lib/bakeryjs/ServiceProvider';
import {MessageData} from '../../src/lib/bakeryjs/Message';

module.exports = boxFactory(
	{
		provides: ['msg'],
		requires: [],
		emits: ['msg'],
		aggregates: false,
	},
	async function(
		serviceProvider: ServiceProvider,
		value: MessageData,
		emit: (chunk: MessageData[], priority?: number) => void
	) {
		return new Promise((resolve) => {
			emit([{msg: 'Hello World!'}, {msg: 'Yellow World!'}]);
			setTimeout(
				() => emit([{msg: 'Hallo Welt!'}, {msg: 'Salut Monde!'}]),
				150
			);
			setTimeout(() => emit([{msg: 'Ola Mundo!'}]), 200);
			setTimeout(resolve, 230);
		});
	}
);
