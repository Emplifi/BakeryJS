import { boxFactory, ServiceProvider, MessageData } from 'bakeryjs'

interface ParameterReaderParams {
	customParam?: string
	numericParam?: number
}

/**
 * A processor that reads parameters from its schema and provides them in the output.
 * Useful for testing parameter injection via the box parameters schema.
 *
 * Parameters:
 * - customParam: A custom string parameter (optional)
 * - numericParam: A numeric parameter (optional)
 *
 * Provides:
 * - paramCustom: The value of customParam
 * - paramNumeric: The value of numericParam
 * - hasParameters: Boolean indicating if parameters were provided
 */
const ParameterReader = boxFactory(
	{
		provides: ['paramCustom', 'paramNumeric', 'hasParameters'],
		requires: [],
		emits: [],
		aggregates: false,
		parameters: {
			type: 'object',
			properties: {
				customParam: { type: 'string' },
				numericParam: { type: 'number' }
			}
		}
	},
	function processValue(serviceProvider: ServiceProvider, _value: MessageData): MessageData {
		const params = (serviceProvider.parameters as ParameterReaderParams) ?? {}
		return {
			paramCustom: params.customParam,
			paramNumeric: params.numericParam,
			hasParameters: params.customParam !== undefined || params.numericParam !== undefined
		}
	}
)

export default ParameterReader
