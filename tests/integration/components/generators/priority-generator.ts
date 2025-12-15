import { boxFactory, ServiceProvider, MessageData } from 'bakeryjs'

interface PriorityGeneratorParams {
	/** Array of items with their priority and optional delay */
	items?: Array<{ value: string; priority: number; delay?: number }>
}

/**
 * A generator that emits messages with different priorities.
 * Each emitted message has a specific priority set at emission time.
 *
 * Parameters:
 * - items: Array of {value, priority, delay?} objects to emit
 *
 * Each emitted message contains:
 * - value: The string value from the item
 * - emitOrder: The order in which the message was emitted (0-based)
 * - emitPriority: The priority with which the message was emitted
 */
const PriorityGenerator = boxFactory(
	{
		provides: ['value', 'emitOrder', 'emitPriority'],
		requires: [],
		emits: ['priority_dim'],
		aggregates: false,
		parameters: {
			type: 'object',
			properties: {
				items: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							value: { type: 'string' },
							priority: { type: 'number' },
							delay: { type: 'number', minimum: 0 }
						},
						required: ['value', 'priority']
					}
				}
			}
		}
	},
	async function processValue(
		serviceProvider: ServiceProvider,
		_value: MessageData,
		emit: (chunk: MessageData[], priority?: number) => void
	): Promise<void> {
		const params = (serviceProvider.parameters as PriorityGeneratorParams) ?? {}
		const items = params.items ?? [
			{ value: 'low', priority: 1 },
			{ value: 'high', priority: 5 },
			{ value: 'medium', priority: 3 }
		]

		for (let i = 0; i < items.length; i++) {
			const item = items[i]
			if (!item) continue
			if (item.delay) {
				await new Promise(resolve => setTimeout(resolve, item.delay))
			}
			emit([{ value: item.value, emitOrder: i, emitPriority: item.priority }], item.priority)
		}
	}
)

export default PriorityGenerator
