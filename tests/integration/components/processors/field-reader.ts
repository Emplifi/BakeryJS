import { boxFactory, ServiceProvider, MessageData } from 'bakeryjs'

/**
 * A processor that requires 'providedField' and outputs its value.
 * Useful for testing field requirement and data flow.
 *
 * Requires:
 * - providedField: The field to read
 *
 * Provides:
 * - readValue: The value of providedField that was read
 * - readTimestamp: When the field was read
 */
const FieldReader = boxFactory(
	{
		provides: ['readValue', 'readTimestamp'],
		requires: ['providedField'],
		emits: [],
		aggregates: false
	},
	function processValue(_serviceProvider: ServiceProvider, value: MessageData): MessageData {
		return {
			readValue: value.providedField,
			readTimestamp: Date.now()
		}
	}
)

export default FieldReader
