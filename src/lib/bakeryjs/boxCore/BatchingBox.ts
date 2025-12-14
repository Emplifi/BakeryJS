import type { BatchingBoxInterface, BatchingBoxMeta, OnCleanCallback } from '../BoxI'
import type { Message, MessageData } from '../Message'
import type { PriorityQueueI } from '../queue/PriorityQueueI'
import type { Logger, ServiceProvider } from '../ServiceProvider'
import VError from 'verror'
import { EventEmitter } from 'events'
import { boxEvents } from '../BoxEvents'
import { noopQueue } from './types'
import { validateAndAddParameters } from './validation'

/**
 * The BatchingBox processes messages in batches rather than individually.
 * It comprises of two levels:
 * 1. Receiving layer from the flow (the method `process`). Decomposes the Message batch,
 *    invokes `processValue` and reacts on its return.
 *
 * 2. Executing layer, meant to be overridden in subclasses.
 */
abstract class BatchingBox extends EventEmitter implements BatchingBoxInterface {
	public readonly name: string
	public readonly meta: BatchingBoxMeta
	public readonly onClean: OnCleanCallback[] = []
	private readonly queue: PriorityQueueI<Message>
	private readonly requireSet: Set<string>
	protected readonly serviceParamsProvider: ServiceProvider

	/**
	 * @param name - name/identifier of the box
	 * @param meta - metadata of the Box. Should be immutable.
	 * @param serviceProvider - container of system & user defined services (logger, ...)
	 * @param queue - the output connection of the Box
	 * @param parameters - any run-time configuration passed from the Job
	 */
	protected constructor(
		name: string,
		meta: BatchingBoxMeta,
		serviceProvider: ServiceProvider,
		queue?: PriorityQueueI<Message>,
		parameters?: any
	) {
		super()
		const { generatorTrace } = boxEvents(this)

		this.name = name
		this.meta = meta
		this.queue = generatorTrace(queue ?? (noopQueue as PriorityQueueI<Message>), name)
		this.requireSet = new Set(this.meta.requires)
		this.serviceParamsProvider = validateAndAddParameters(
			meta.parameters,
			parameters,
			serviceProvider
		)
	}

	private async processMapper(batch: Message[]): Promise<any> {
		try {
			const result = await this.processValue(
				new Proxy(
					batch.map(msg => msg.getInput(this.meta.requires)),
					{
						get: (target: MessageData[], prop: any, receiver) => {
							if (this.requireSet.has(prop) && !Number.isInteger(prop) && !Array.prototype[prop]) {
								throw new VError(
									{
										name: 'BatchError',
										info: { property: prop }
									},
									'Accessing property %s on the whole batch. Probably the box requires batching but the executive code assumes single message.',
									prop
								)
							} else {
								return Reflect.get(target, prop, receiver)
							}
						}
					}
				)
			)
			this.queue.push(
				result.map((msg: MessageData, index: number) => {
					const batchItem = batch[index]
					if (!batchItem) {
						throw new Error(`Batch item at index ${index} is undefined`)
					}
					batchItem.setOutput(this.meta.provides, msg)
					return batchItem
				})
			)
			return
		} catch (error) {
			const cause = error instanceof Error ? error : new Error(String(error))
			throw new VError(
				{
					name: 'BoxInvocationException',
					cause,
					info: {
						mode: 'mapper',
						box: { name: this.name, meta: this.meta },
						batch: batch.map(msg => msg.getInput(this.meta.requires))
					}
				},
				"The box '%s' in a %s mode encountered an exception.",
				this.name,
				'mapper'
			)
		}
	}

	/**
	 * The processing function -- dispatcher on metadata information.
	 *
	 * @param batch - A Message[] to act on
	 * @returns Promise -- just an indication of finished processing
	 * @internalapi
	 */
	public async process(batch: Message[]): Promise<any> {
		if (this.meta.aggregates) {
			throw new VError(
				{
					name: 'NotImplementedError',
					message: "Box '%s': Aggregator has not been implemented yet.",
					info: { name: this.name, meta: this.meta }
				},
				this.name
			)
		}

		if (batch.length === 0) {
			return
		}

		try {
			return await this.processMapper(batch)
		} catch (error) {
			this.serviceParamsProvider.get<Logger>('logger').error(error)
			return null
		}
	}

	/**
	 * The routine that contains the business logic of the BatchingBox.
	 * @internalapi
	 */
	protected abstract processValue(
		msgBatch: MessageData[]
	): Promise<MessageData[]> | MessageData[] | Promise<any>
}

export { BatchingBox }
