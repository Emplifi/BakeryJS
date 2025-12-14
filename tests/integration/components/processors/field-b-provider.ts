import { boxFactory, ServiceProvider, MessageData } from 'bakeryjs'

/**
 * A processor that provides field 'fieldB' with value 'valueB'.
 * Useful for testing diamond pattern and field accumulation in parallel branches.
 */
const FieldBProvider = boxFactory(
	{
		provides: ['fieldB'],
		requires: [],
		emits: [],
		aggregates: false
	},
	function processValue(_serviceProvider: ServiceProvider, _value: MessageData): MessageData {
		return { fieldB: 'valueB' }
	}
)

export default FieldBProvider
