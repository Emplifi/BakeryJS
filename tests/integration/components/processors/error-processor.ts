import { boxFactory, ServiceProvider, MessageData } from 'bakeryjs'

interface ErrorProcessorParams {
	errorMessage?: string
}

/**
 * A processor that throws an error when processing.
 * Useful for testing error handling and propagation in flows.
 *
 * Parameters:
 * - errorMessage: Custom error message (optional, defaults to "Intentional test error")
 */
const ErrorProcessor = boxFactory(
	{
		provides: [],
		requires: [],
		emits: [],
		aggregates: false,
		parameters: {
			type: 'object',
			properties: {
				errorMessage: { type: 'string' }
			}
		}
	},
	function processValue(serviceProvider: ServiceProvider, _value: MessageData): MessageData {
		const params = (serviceProvider.parameters as ErrorProcessorParams) ?? {}
		throw new Error(params.errorMessage ?? 'Intentional test error')
	}
)

export default ErrorProcessor
