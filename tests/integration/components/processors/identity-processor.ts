import { boxFactory, ServiceProvider, MessageData } from 'bakeryjs'

/**
 * A pass-through processor that doesn't transform data.
 * Useful for testing flow topology without modifying messages.
 */
const IdentityProcessor = boxFactory(
	{
		provides: [],
		requires: [],
		emits: [],
		aggregates: false
	},
	function processValue(_serviceProvider: ServiceProvider, _value: MessageData): MessageData {
		return {}
	}
)

export default IdentityProcessor
