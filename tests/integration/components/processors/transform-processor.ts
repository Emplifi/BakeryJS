import { boxFactory, ServiceProvider, MessageData } from 'bakeryjs'

/**
 * A processor that adds a 'transformed' field with the current timestamp.
 * Useful for testing that messages flow through processors and are modified.
 */
const TransformProcessor = boxFactory(
	{
		provides: ['transformed'],
		requires: [],
		emits: [],
		aggregates: false
	},
	function processValue(_serviceProvider: ServiceProvider, _value: MessageData): MessageData {
		return { transformed: Date.now() }
	}
)

export default TransformProcessor
