import { boxFactory, ServiceProvider, MessageData } from 'bakeryjs'

interface NonErrorThrowerParams {
	throwValue?: string
}

/**
 * A processor that throws a non-Error value (string).
 * Useful for testing that non-Error throws are converted to Error.
 *
 * Parameters:
 * - throwValue: The string value to throw (optional, defaults to "string error thrown")
 */
const NonErrorThrower = boxFactory(
	{
		provides: [],
		requires: [],
		emits: [],
		aggregates: false,
		parameters: {
			type: 'object',
			properties: {
				throwValue: { type: 'string' }
			}
		}
	},
	function processValue(serviceProvider: ServiceProvider, _value: MessageData): MessageData {
		const params = (serviceProvider.parameters as NonErrorThrowerParams) ?? {}

		throw params.throwValue ?? 'string error thrown'
	}
)

export default NonErrorThrower
