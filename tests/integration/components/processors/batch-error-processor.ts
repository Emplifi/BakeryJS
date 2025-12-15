import { boxFactory, ServiceProvider, MessageData } from 'bakeryjs'
import { BatchingBoxMeta } from '../../../../src/lib/bakeryjs/BoxI'

interface BatchErrorProcessorParams {
	errorMessage?: string
}

/**
 * A batching processor that throws an error when processing.
 * Useful for testing error handling in BatchingBox flows.
 *
 * Parameters:
 * - errorMessage: Custom error message (optional, defaults to "Intentional batch error")
 */
const BatchErrorProcessor = boxFactory(
	{
		provides: [],
		requires: [],
		aggregates: false,
		batch: {
			maxSize: 3,
			timeoutSeconds: 0.1
		},
		parameters: {
			type: 'object',
			properties: {
				errorMessage: { type: 'string' }
			}
		}
	} as BatchingBoxMeta,
	async function processValue(
		serviceProvider: ServiceProvider,
		_batch: MessageData[]
	): Promise<MessageData[]> {
		const params = (serviceProvider.parameters as BatchErrorProcessorParams) ?? {}
		throw new Error(params.errorMessage ?? 'Intentional batch error')
	}
)

export default BatchErrorProcessor
