/**
 * Nested Generator Box for Complex Flow Benchmarking
 *
 * This generator creates child messages for each incoming message,
 * simulating a second level of generation in a complex flow.
 * The number of items is controlled by the 'nestedItemCount' parameter.
 */
import { boxFactory, ServiceProvider, MessageData } from '../../../src'

const DEFAULT_NESTED_COUNT = 10

module.exports = boxFactory(
	{
		provides: ['nestedItem', 'nestedGeneratorId', 'nestedTimestamp', 'parentItem'],
		requires: ['item'],
		emits: ['benchmark_nested_items'],
		aggregates: false,
		parameters: {
			title: 'Number of nested items to generate per parent',
			type: 'number',
			minimum: 1,
			maximum: 100000,
			default: DEFAULT_NESTED_COUNT
		}
	},
	async function processValue(
		serviceProvider: ServiceProvider,
		value: MessageData,
		emit: (chunk: MessageData[], priority?: number) => void
	): Promise<void> {
		const nestedCount = (serviceProvider.parameters as number) || DEFAULT_NESTED_COUNT
		const nestedGeneratorId = 'gen2'
		const parentItem = value.item as number

		const items: MessageData[] = []

		for (let i = 0; i < nestedCount; i++) {
			items.push({
				nestedItem: i,
				parentItem,
				nestedGeneratorId,
				nestedTimestamp: Date.now()
			})
		}

		emit(items)
	}
)
