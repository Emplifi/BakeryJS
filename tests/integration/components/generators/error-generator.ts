import { boxFactory, ServiceProvider, MessageData } from 'bakeryjs'

interface ErrorGeneratorParams {
	errorMessage?: string
	delayBeforeError?: number
}

/**
 * A generator that throws an error during processing.
 * Useful for testing error handling in generator flows.
 *
 * Parameters:
 * - errorMessage: Custom error message (optional, defaults to "Intentional generator error")
 * - delayBeforeError: Milliseconds to wait before throwing (optional)
 */
const ErrorGenerator = boxFactory(
	{
		provides: ['value'],
		requires: [],
		emits: ['error_dim'],
		aggregates: false,
		parameters: {
			type: 'object',
			properties: {
				errorMessage: { type: 'string' },
				delayBeforeError: { type: 'number', minimum: 0 }
			}
		}
	},
	async function processValue(
		serviceProvider: ServiceProvider,
		_value: MessageData,
		_emit: (chunk: MessageData[], priority?: number) => void
	): Promise<void> {
		const params = (serviceProvider.parameters as ErrorGeneratorParams) ?? {}

		if (params.delayBeforeError) {
			await new Promise(resolve => setTimeout(resolve, params.delayBeforeError))
		}

		throw new Error(params.errorMessage ?? 'Intentional generator error')
	}
)

export default ErrorGenerator
