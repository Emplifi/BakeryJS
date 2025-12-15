import { boxFactory, ServiceProvider, MessageData } from 'bakeryjs'

interface ConditionalErrorParams {
	/** Fail on odd indices if true */
	failOnOddIndex?: boolean
	/** Fail on even indices if true */
	failOnEvenIndex?: boolean
	/** Custom error message */
	errorMessage?: string
}

/**
 * A processor that throws an error conditionally based on message content.
 * Useful for testing partial failure scenarios where some messages fail
 * and others succeed.
 *
 * Parameters:
 * - failOnOddIndex: Throw error if index is odd (default: true)
 * - failOnEvenIndex: Throw error if index is even (default: false)
 * - errorMessage: Custom error message prefix
 *
 * Requires 'index' field from incoming message.
 * Provides 'processed' field for successfully processed messages.
 */
const ConditionalErrorProcessor = boxFactory(
	{
		provides: ['processed'],
		requires: ['index'],
		emits: [],
		aggregates: false,
		parameters: {
			type: 'object',
			properties: {
				failOnOddIndex: { type: 'boolean' },
				failOnEvenIndex: { type: 'boolean' },
				errorMessage: { type: 'string' }
			}
		}
	},
	function processValue(serviceProvider: ServiceProvider, value: MessageData): MessageData {
		const params = (serviceProvider.parameters as ConditionalErrorParams) ?? {}
		const failOnOdd = params.failOnOddIndex ?? true
		const failOnEven = params.failOnEvenIndex ?? false
		const index = value.index as number

		const shouldFail = (failOnOdd && index % 2 === 1) || (failOnEven && index % 2 === 0)

		if (shouldFail) {
			const message = params.errorMessage ?? 'Conditional error'
			throw new Error(`${message} at index ${index}`)
		}

		return { processed: true }
	}
)

export default ConditionalErrorProcessor
