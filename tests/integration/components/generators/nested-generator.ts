import { boxFactory, ServiceProvider, MessageData } from 'bakeryjs'

interface NestedGeneratorParams {
	/** Number of messages to emit */
	count?: number
	/** Prefix to add to values */
	prefix?: string
}

/**
 * A generator intended for use inside another generator's sub-flow.
 * Useful for testing nested generator scenarios (2-level dimension nesting).
 *
 * Parameters:
 * - count: Number of messages to emit (default: 2)
 * - prefix: Prefix for the value field (default: "nested")
 *
 * Each emitted message contains:
 * - nestedValue: A string like "nested-0", "nested-1", etc.
 * - nestedIndex: The numeric index of the message
 * - parentValue: The value field from the parent message (if present)
 */
const NestedGenerator = boxFactory(
	{
		provides: ['nestedValue', 'nestedIndex', 'parentValue'],
		requires: ['value'],
		emits: ['nested_dim'],
		aggregates: false,
		parameters: {
			type: 'object',
			properties: {
				count: { type: 'number', minimum: 0 },
				prefix: { type: 'string' }
			}
		}
	},
	async function processValue(
		serviceProvider: ServiceProvider,
		value: MessageData,
		emit: (chunk: MessageData[], priority?: number) => void
	): Promise<void> {
		const params = (serviceProvider.parameters as NestedGeneratorParams) ?? {}
		const count = params.count ?? 2
		const prefix = params.prefix ?? 'nested'

		const messages: MessageData[] = []
		for (let i = 0; i < count; i++) {
			messages.push({
				nestedValue: `${prefix}-${i}`,
				nestedIndex: i,
				parentValue: value.value ?? null
			})
		}

		emit(messages)
	}
)

export default NestedGenerator
