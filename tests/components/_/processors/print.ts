import { boxFactory, ServiceProvider, MessageData, Logger } from 'bakeryjs'

const Print = boxFactory(
	{
		requires: ['jobId', 'raw'],
		provides: [],
		emits: [],
		aggregates: false
	},
	function processValue(
		services: ServiceProvider,
		input: MessageData,
		_neverEmit: (chunk: MessageData[], priority?: number) => void
	): MessageData {
		services.get<Logger>('logger').log({ printBox: JSON.stringify(input) })
		return {}
	}
)
export default Print
