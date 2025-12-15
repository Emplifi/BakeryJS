import { boxFactory, ServiceProvider, MessageData } from 'bakeryjs'

/**
 * A processor that requires both 'fieldA' and 'fieldB' and merges them.
 * Useful for testing diamond pattern where multiple parallel branches converge.
 *
 * Requires:
 * - fieldA: Value from branch A
 * - fieldB: Value from branch B
 *
 * Provides:
 * - mergedField: Combined value of fieldA and fieldB
 */
const MergeFields = boxFactory(
	{
		provides: ['mergedField'],
		requires: ['fieldA', 'fieldB'],
		emits: [],
		aggregates: false
	},
	function processValue(_serviceProvider: ServiceProvider, value: MessageData): MessageData {
		return { mergedField: `${value.fieldA}+${value.fieldB}` }
	}
)

export default MergeFields
