import { boxFactory, ServiceProvider, MessageData } from 'bakeryjs'

/**
 * A processor that provides field 'fieldA' with value 'valueA'.
 * Useful for testing diamond pattern and field accumulation in parallel branches.
 */
const FieldAProvider = boxFactory(
	{
		provides: ['fieldA'],
		requires: [],
		emits: [],
		aggregates: false
	},
	function processValue(_serviceProvider: ServiceProvider, _value: MessageData): MessageData {
		return { fieldA: 'valueA' }
	}
)

export default FieldAProvider
