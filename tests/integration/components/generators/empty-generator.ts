import { boxFactory, ServiceProvider, MessageData } from 'bakeryjs'

/**
 * A generator that emits no messages (empty array).
 * Useful for testing edge cases where a generator produces no output.
 */
const EmptyGenerator = boxFactory(
	{
		provides: ['value'],
		requires: [],
		emits: ['empty_dim'],
		aggregates: false
	},
	async function processValue(
		_serviceProvider: ServiceProvider,
		_value: MessageData,
		emit: (chunk: MessageData[], priority?: number) => void
	): Promise<void> {
		// Emit an empty array - no messages
		emit([])
	}
)

export default EmptyGenerator
