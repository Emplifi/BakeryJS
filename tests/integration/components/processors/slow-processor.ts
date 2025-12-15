import { boxFactory, ServiceProvider, MessageData } from 'bakeryjs'

interface SlowProcessorParams {
	/** Delay in milliseconds before processing completes */
	delay?: number
}

/**
 * A processor that introduces a configurable delay before returning.
 * Useful for testing timing-sensitive flows and async processing.
 *
 * Parameters:
 * - delay: Milliseconds to wait before returning (default: 50)
 *
 * Adds a 'processedAfterDelay' timestamp to the message.
 */
const SlowProcessor = boxFactory(
	{
		provides: ['processedAfterDelay'],
		requires: [],
		emits: [],
		aggregates: false,
		parameters: {
			type: 'object',
			properties: {
				delay: { type: 'number', minimum: 0 }
			}
		}
	},
	async function processValue(
		serviceProvider: ServiceProvider,
		_value: MessageData
	): Promise<MessageData> {
		const params = (serviceProvider.parameters as SlowProcessorParams) ?? {}
		const delay = params.delay ?? 50

		await new Promise(resolve => setTimeout(resolve, delay))

		return { processedAfterDelay: Date.now() }
	}
)

export default SlowProcessor
