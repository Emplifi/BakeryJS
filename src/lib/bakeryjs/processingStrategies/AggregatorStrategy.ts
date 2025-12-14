import type { Message } from '../Message'
import type { ProcessingStrategy, BoxProcessingContext } from './ProcessingStrategy'
import VError from 'verror'

/**
 * Strategy for processing messages in aggregator mode.
 * Aggregates multiple messages into a single output (not yet implemented).
 */
export class AggregatorStrategy implements ProcessingStrategy {
	public async execute(_msg: Message, context: BoxProcessingContext): Promise<never> {
		throw new VError(
			{
				name: 'NotImplementedError',
				message: "Box '%s': Aggregator has not been implemented yet.",
				info: {
					name: context.name,
					meta: context.meta
				}
			},
			context.name
		)
	}
}
