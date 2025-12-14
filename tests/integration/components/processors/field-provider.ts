import { boxFactory, ServiceProvider, MessageData } from 'bakeryjs'

interface FieldProviderParams {
	/** Field name to provide */
	fieldName?: string
	/** Field value to set */
	fieldValue?: unknown
}

/**
 * A processor that provides a configurable field with a configurable value.
 * Useful for testing field provision and accumulation.
 *
 * Parameters:
 * - fieldName: Name of the field to provide (default: "providedField")
 * - fieldValue: Value to set for the field (default: "provided-value")
 *
 * Note: Due to BoxMeta limitations, this always provides 'providedField'.
 * The fieldName parameter is for documentation/testing reference only.
 */
const FieldProvider = boxFactory(
	{
		provides: ['providedField'],
		requires: [],
		emits: [],
		aggregates: false,
		parameters: {
			type: 'object',
			properties: {
				fieldName: { type: 'string' },
				fieldValue: {}
			}
		}
	},
	function processValue(serviceProvider: ServiceProvider, _value: MessageData): MessageData {
		const params = (serviceProvider.parameters as FieldProviderParams) ?? {}
		const fieldValue = params.fieldValue ?? 'provided-value'

		return { providedField: fieldValue }
	}
)

export default FieldProvider
