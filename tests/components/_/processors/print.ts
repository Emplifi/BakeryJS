import {boxFactory, ServiceProvider, MessageData} from 'bakeryjs';

const Print = boxFactory(
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
