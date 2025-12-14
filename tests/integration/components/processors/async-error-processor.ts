import { boxFactory, ServiceProvider, MessageData } from 'bakeryjs'

interface AsyncErrorProcessorParams {
	errorMessage?: string
	delayBeforeError?: number
}

/**
 * A processor that throws an error asynchronously after a delay.
 * Useful for testing async error handling in flows.
 *
 * Parameters:
 * - errorMessage: Custom error message (optional, defaults to "Intentional async error")
 * - delayBeforeError: Milliseconds to wait before throwing (optional, default: 10)
 */
const AsyncErrorProcessor = boxFactory(
	{
		provides: [],
		requires: [],
		emits: [],
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
		_value: MessageData
	): Promise<MessageData> {
		const params = (serviceProvider.parameters as AsyncErrorProcessorParams) ?? {}
		const delay = params.delayBeforeError ?? 10

		await new Promise(resolve => setTimeout(resolve, delay))

		throw new Error(params.errorMessage ?? 'Intentional async error')
	}
)

export default AsyncErrorProcessor
