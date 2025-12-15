/**
 * Timed Mapper Box for Benchmarking
 *
 * A simple mapper that tracks processing time and optionally adds
 * an artificial delay to simulate real-world processing.
 */
import { boxFactory, ServiceProvider, MessageData } from '../../../src'

module.exports = boxFactory(
	{
		provides: ['processed', 'processorId', 'processedAt'],
		requires: [],
		emits: [],
		aggregates: false,
		parameters: {
			title: 'Artificial delay in milliseconds (0 = no delay)',
			type: 'number',
			minimum: 0,
			maximum: 1000,
			default: 0
		}
	},
	async function processValue(
		serviceProvider: ServiceProvider,
		value: MessageData
	): Promise<MessageData> {
		const delayMs = (serviceProvider.parameters as number) || 0

		if (delayMs > 0) {
			await new Promise(resolve => setTimeout(resolve, delayMs))
		}

		return {
			processed: true,
			processorId: 'mapper',
			processedAt: Date.now()
		}
	}
)
