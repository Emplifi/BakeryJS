import { boxFactory, ServiceProvider, MessageData } from 'bakeryjs'

/**
 * Shared state for accumulating processed messages across multiple calls.
 * This allows test assertions on the order and content of processed messages.
 */
export const accumulatedMessages: MessageData[] = []

/**
 * Clears the accumulated messages. Call this in beforeEach() hooks.
 */
export function clearAccumulator(): void {
	accumulatedMessages.length = 0
}

/**
 * A processor that accumulates all processed messages in a shared array.
 * Useful for testing the order and content of messages through a flow.
 *
 * The processor adds a 'processedAt' field with the processing timestamp
 * and an 'accumulatorIndex' field with the order in which it was processed.
 *
 * Requires 'value' field to capture the message value for priority testing.
 *
 * Use clearAccumulator() in beforeEach() to reset between tests.
 */
const AccumulatorProcessor = boxFactory(
	{
		provides: ['processedAt', 'accumulatorIndex'],
		requires: ['value'],
		emits: [],
		aggregates: false
	},
	function processValue(_serviceProvider: ServiceProvider, value: MessageData): MessageData {
		const index = accumulatedMessages.length
		const processedAt = Date.now()

		// Store a copy of the incoming message with processing metadata
		accumulatedMessages.push({
			...value,
			processedAt,
			accumulatorIndex: index
		})

		return { processedAt, accumulatorIndex: index }
	}
)

export default AccumulatorProcessor
