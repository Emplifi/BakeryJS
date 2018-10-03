import {ServiceProvider} from '../../src/lib/bakeryjs/ServiceProvider';
import {MessageData} from '../../src/lib/bakeryjs/Message';
import {boxFactory} from '../../src/lib/bakeryjs/Box';

module.exports = boxFactory(
	'wordBatchCount',
	{
		provides: ['words'],
		requires: ['msg'],
		aggregates: false,
		batch: {
			maxSize: 3,
			timeoutSeconds: 0.3,
		},
	},
	async function(serviceProvider: ServiceProvider, values: MessageData[]) {
		return values.map((value) =>
			Object.create(null, {
				words: {value: (value.msg as string).split(/\W+/).length},
			})
		);
	}
);
