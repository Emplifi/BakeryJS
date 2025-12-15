import type { Message, MessageData } from '../Message'
import type { ProcessingStrategy, BoxProcessingContext } from './ProcessingStrategy'
import VError from 'verror'
import { BoxErrorFactory } from '../errors/BoxErrorFactory'

const MISBEHAVE_DESCRIPTION =
	'Generator should return a promise that would be resolved once all the messages had been emitted.' +
	'  This error occurs when generator attempts to emit messages after its promise has been resolved.' +
	'  The code of the generator should be repaired to keep the contract.'

/**
 * Creates a revocable queue proxy that prevents emissions after resolution.
 */
function createGuardedQueue(queue: {
	push: (msgs: Message | Message[], priority?: number) => void
}): {
	push: (msgs: Message | Message[], priority?: number) => void
	revoke: () => void
} {
	const { proxy, revoke } = Proxy.revocable(queue.push, {
		apply: (tgt, _thisArg, argsList) => {
			Reflect.apply(tgt, queue, argsList)
		}
	})
	return { push: proxy, revoke }
}

/**
 * Strategy for processing messages in generator mode.
 * Transforms a single message into multiple output messages.
 */
export class GeneratorStrategy implements ProcessingStrategy {
	public async execute(msg: Message, context: BoxProcessingContext): Promise<boolean> {
		let siblingsCount = 0
		const guardedQ = createGuardedQueue(context.queue)

		try {
			const retValue = await context.processValue(
				msg.getInput(context.meta.requires),
				(chunk: MessageData[], priority?: number) => {
					siblingsCount += chunk.length
					guardedQ.push(
						chunk.map(msgData => {
							const parent: Message = msg.create()
							parent.setOutput(context.meta.provides, msgData)
							return parent
						}),
						priority
					)
				}
			)

			guardedQ.revoke()
			context.emit('generation_finished', [
				{
					boxName: context.name,
					messageId: msg.id,
					parentMsgId: msg.parent && msg.parent.id,
					generated: siblingsCount
				}
			])

			return retValue
		} catch (error) {
			throw this.handleError(error, msg, context)
		}
	}

	private handleError(error: unknown, msg: Message, context: BoxProcessingContext): VError {
		const boxInfo = { name: context.name, meta: context.meta }
		const inputValue = msg.getInput(context.meta.requires)

		if (error instanceof TypeError && (error as Error).message.includes('revoked')) {
			return BoxErrorFactory.misbehaveError(boxInfo, MISBEHAVE_DESCRIPTION, inputValue)
		}

		return BoxErrorFactory.invocationError(
			boxInfo,
			'generator',
			BoxErrorFactory.toError(error),
			inputValue
		)
	}
}
