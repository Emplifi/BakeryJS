import { boxFactory, ServiceProvider, MessageData } from 'bakeryjs'

interface ConfigurableGeneratorParams {
	count: number
	delay?: number
	priority?: number
}

/**
 * A configurable generator that emits a specified number of messages.
 *
 * Parameters:
 * - count: Number of messages to emit (required)
 * - delay: Milliseconds to wait before emitting (optional)
 * - priority: Priority level for emitted messages (optional)
 *
 * Each emitted message contains:
 * - value: A string like "item-0", "item-1", etc.
 * - index: The numeric index of the message
 */
const ConfigurableGenerator = boxFactory(
	{
		provides: ['value', 'index'],
		requires: [],
		emits: ['configurable_dim'],
		aggregates: false,
		parameters: {
			type: 'object',
			properties: {
				count: { type: 'number', minimum: 0 },
				delay: { type: 'number', minimum: 0 },
				priority: { type: 'number' }
			},
			required: ['count']
		}
	},
	async function processValue(
		serviceProvider: ServiceProvider,
		_value: MessageData,
		emit: (chunk: MessageData[], priority?: number) => void
	): Promise<void> {
		const params = serviceProvider.parameters as ConfigurableGeneratorParams
		const messages: MessageData[] = []

		for (let i = 0; i < params.count; i++) {
			messages.push({ value: `item-${i}`, index: i })
		}

		if (params.delay) {
			await new Promise(resolve => setTimeout(resolve, params.delay))
		}

		emit(messages, params.priority)
	}
)

export default ConfigurableGenerator
