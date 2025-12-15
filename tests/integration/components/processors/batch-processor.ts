import { boxFactory, ServiceProvider, MessageData } from 'bakeryjs'
import { BatchingBoxMeta } from '../../../../src/lib/bakeryjs/BoxI'

/**
 * Shared state for tracking batch processing order and sizes.
 * This allows test assertions on how batches are formed and processed.
 */
export const batchProcessingLog: Array<{
	batchSize: number
	items: MessageData[]
	processedAt: number
}> = []

/**
 * Clears the batch processing log. Call this in beforeEach() hooks.
 */
export function clearBatchLog(): void {
	batchProcessingLog.length = 0
}

/**
 * A batching processor that collects messages into batches before processing.
 * Useful for testing BatchingBox behavior.
 *
 * Parameters:
 * - maxSize: Maximum batch size (default: 3)
 * - timeoutSeconds: Timeout before processing partial batch (default: 0.1)
 *
 * Provides:
 * - batchId: A unique identifier for the batch this message was processed in
 * - batchIndex: The index of this message within its batch
 * - batchSize: The total size of the batch
 */
const BatchProcessor = boxFactory(
	{
		provides: ['batchId', 'batchIndex', 'batchSize'],
		requires: ['index'],
		aggregates: false,
		batch: {
			maxSize: 3,
			timeoutSeconds: 0.1
		},
		parameters: {
			type: 'object',
			properties: {
				maxSize: { type: 'number', minimum: 1 },
				timeoutSeconds: { type: 'number', minimum: 0 }
			}
		}
	} as BatchingBoxMeta,
	async function processValue(
		_serviceProvider: ServiceProvider,
		batch: MessageData[]
	): Promise<MessageData[]> {
		const batchId = Date.now() + Math.random()
		const processedAt = Date.now()

		// Log the batch for test assertions
		batchProcessingLog.push({
			batchSize: batch.length,
			items: batch.map(item => ({ ...item })),
			processedAt
		})

		// Return batch results with batch metadata
		// Note: The batch processor only provides new fields; original fields
		// are preserved by the framework when setOutput is called
		return batch.map((_item, index) => ({
			batchId,
			batchIndex: index,
			batchSize: batch.length
		}))
	}
)

export default BatchProcessor
