import type { BoxInterface, BoxMeta, OnCleanCallback } from '../BoxI'
import type { Message, MessageData } from '../Message'
import type { PriorityQueueI } from '../queue/PriorityQueueI'
import type { Logger, ServiceProvider } from '../ServiceProvider'
import type { BoxProcessingContext } from '../processingStrategies'
import { EventEmitter } from 'events'
import { boxEvents } from '../BoxEvents'
import { getProcessingMode, ProcessingMode, getProcessingStrategy } from '../processingStrategies'
import { noopQueue } from './types'
import { validateAndAddParameters } from './validation'

/**
 * The Box is a basic unit of execution. It comprises of two levels:
 * 1. Receiving layer from the flow (the method `process`). Decomposes the Message, invokes `processValue` and
 * reacts on its return.
 *
 * 2. Executing layer, meant to be overridden in subclasses.
 *
 * TODO: (idea2) The 1. layer should be moved into the flow executor.
 */
abstract class Box extends EventEmitter implements BoxInterface {
	private readonly queue: PriorityQueueI<Message>
	protected readonly serviceParamsProvider: ServiceProvider
	public readonly name: string
	public readonly meta: BoxMeta
	public readonly onClean: OnCleanCallback[] = []

	/**
	 * @param name - name/identifier of the box
	 * @param meta - metadata of the Box. Should be immutable.
	 * @param serviceProvider - container of system & user defined services (logger, ...)
	 * @param queue - the output connection of the Box
	 * @param parameters - any run-time configuration passed from the Job
	 * @emits 'msg_finished', 'generation_finished'
	 */
	protected constructor(
		name: string,
		meta: BoxMeta,
		serviceProvider: ServiceProvider,
		queue?: PriorityQueueI<Message>,
		parameters?: any
	) {
		super()
		const { generatorTrace } = boxEvents(this)
		this.name = name
		this.meta = meta
		this.queue = generatorTrace(queue ?? (noopQueue as PriorityQueueI<Message>), name)
		this.serviceParamsProvider = validateAndAddParameters(
			meta.parameters,
			parameters,
			serviceProvider
		)
	}

	/**
	 * Creates the processing context for strategy execution.
	 * This provides strategies with all needed dependencies.
	 */
	private createProcessingContext(): BoxProcessingContext {
		return {
			name: this.name,
			meta: {
				requires: this.meta.requires,
				provides: this.meta.provides,
				emits: this.meta.emits
			},
			processValue: (msg: MessageData, emit: (batch: MessageData[], priority?: number) => void) =>
				this.processValue(msg, emit),
			queue: this.queue,
			emit: (event: string, data: any) => this.emit(event, data)
		}
	}

	/**
	 * The processing function -- uses strategy pattern for dispatch.
	 * Determines processing mode from metadata and delegates to appropriate strategy.
	 *
	 * @param msg - A Message to act on
	 * @returns Promise -- just an indication of finished processing
	 * @internalapi
	 */
	public async process(msg: Message): Promise<any> {
		const mode = getProcessingMode(this.meta)
		const strategy = getProcessingStrategy(mode)
		const context = this.createProcessingContext()

		// Aggregator errors should bubble up directly (not caught)
		if (mode === ProcessingMode.Aggregator) {
			return await strategy.execute(msg, context)
		}

		try {
			await strategy.execute(msg, context)
			// Generator returns true to indicate completion
			if (mode === ProcessingMode.Generator) {
				return true
			}
			return
		} catch (error) {
			this.serviceParamsProvider.get<Logger>('logger').error(error)
			return null
		}
	}

	/**
	 * The routine that contains the business logic of the Box.
	 * @internalapi
	 */
	protected abstract processValue(
		msg: MessageData,
		emit: (batch: MessageData[], priority?: number) => void
	): Promise<MessageData> | MessageData | Promise<any>
}

export { Box }
