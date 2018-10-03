import {MessageData} from '../../../lib/bakeryjs/Message';
import {ServiceProvider} from '../../../lib/bakeryjs/ServiceProvider';
import {boxFactory} from '../../../lib/bakeryjs/Box';

const Print = boxFactory(
	'print',
	{
		requires: ['jobId', 'raw'],
		provides: [],
		emits: [],
		aggregates: false,
	},
	function processValue(
		services: ServiceProvider,
		input: MessageData,
		neverEmit: (chunk: MessageData[], priority?: number) => void
	): MessageData {
		services.get('logger').log({printBox: JSON.stringify(input)});
		return {};
	}
);
export default Print;
