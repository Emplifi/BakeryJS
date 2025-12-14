import type { Message, MessageData } from '../Message'
import type { ProcessingStrategy, BoxProcessingContext } from './ProcessingStrategy'
import { BoxErrorFactory } from '../errors/BoxErrorFactory'

/**
 * Strategy for processing messages in mapper mode.
 * Transforms a single message into a single output message.
 */
export class MapperStrategy implements ProcessingStrategy {
	public async execute(msg: Message, context: BoxProcessingContext): Promise<void> {
		try {
			const result = await context.processValue(
				msg.getInput(context.meta.requires),
				(_chunk: MessageData[], _priority?: number) => this.neverEmitCallback(context.name)
			)
			msg.setOutput(context.meta.provides, result)
			context.queue.push(msg)
		} catch (error) {
			throw BoxErrorFactory.invocationError(
				{ name: context.name, meta: context.meta },
				'mapper',
				BoxErrorFactory.toError(error),
				msg.getInput(context.meta.requires)
			)
		}
	}

	private neverEmitCallback(boxName: string): never {
		throw BoxErrorFactory.inconsistentBoxError(boxName)
	}
}
