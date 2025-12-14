/**
 * Configurable Generator Box for Benchmarking
 *
 * Generates a configurable number of messages for benchmarking purposes.
 * The number of items is controlled by the 'itemCount' parameter.
 */
import {boxFactory, ServiceProvider, MessageData} from '../../../src';

const DEFAULT_ITEM_COUNT = 100;

module.exports = boxFactory(
	{
		provides: ['item', 'generatorId', 'timestamp'],
		requires: [],
		emits: ['benchmark_items'],
		aggregates: false,
		parameters: {
			title: 'Number of items to generate',
			type: 'number',
			minimum: 1,
			maximum: 10000000,
			default: DEFAULT_ITEM_COUNT,
		},
	},
	async function processValue(
		serviceProvider: ServiceProvider,
		value: MessageData,
		emit: (chunk: MessageData[], priority?: number) => void
	): Promise<void> {
		const itemCount =
			(serviceProvider.parameters as number) || DEFAULT_ITEM_COUNT;
		const generatorId = 'gen1';
		const batchSize = 100; // Emit in batches for efficiency

		const items: MessageData[] = [];

		for (let i = 0; i < itemCount; i++) {
			items.push({
				item: i,
				generatorId,
				timestamp: Date.now(),
			});

			// Emit in batches
			if (items.length >= batchSize) {
				emit(items.slice());
				items.length = 0;
			}
		}

		// Emit remaining items
		if (items.length > 0) {
			emit(items);
		}
	}
);
