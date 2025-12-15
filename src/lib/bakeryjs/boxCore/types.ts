import type { Message, MessageData } from '../Message'
import type { PriorityQueueI } from '../queue/PriorityQueueI'
import type { ServiceProvider } from '../ServiceProvider'
import type { BoxInterface, BatchingBoxInterface } from '../BoxI'

/**
 * A no-operation queue used when no output queue is provided.
 * Messages pushed to this queue are silently discarded.
 */
export const noopQueue: PriorityQueueI<any> = {
	push: (_msg: any, _priority?: number) => undefined,
	length: 0,
	target: ''
}

/**
 * Type of the executing code definition of the Box.
 *
 * The routine that contains the business logic of the Box.  The capability of the function are stated
 * in the metadata, namely *provides*, *emits* and *aggregates*.
 *
 * ### The box does not *aggregate*
 * - When called with `value` only -> it serves as a mapper and *must* return (promise) of MessageData,
 * - when called with both `value` and `emit` -> it serves as a generator and
 *   - each new message emits by calling `emit([data], priority?)`
 *   - when finished with generating, resolves the returned Promise to any value
 *
 * ### The box *aggregates*
 * TODO: (idea1) how is the api for aggregation?
 *
 * @param serviceParamsProvider A container holding built-in and used defined services (logger, statsd, ...) and
 *    run time parameters of the box.
 *    Your code can freely use the services, e.g. `serviceParamsProvider.get('logger').log(...)` or parameters
 *    `serviceParamsProvider.parameters`.
 * @param value The data input into your box.  The data object will have only those attributes that are
 *     explicitly required in the box metadata.  Your code can set any attributes to the message, but only those
 *     explicitly stated in the metadata will be confirmed.  The other will be discarded.
 * @param emit When your box is a generator, this is a means of outputting the particular data without
 *    leaving the box.  Just call `emit(<array of MessageData>, <priority>)`.  Only such attributes of the output
 *    messages are persisted, that are stated explicitly in the box's metadata.
 * @param parameters The box can (but it does not have to) receive run-time parameters from the job.  The parameters
 *     are passed if and only if the box has properly defined validation scheme in metadata.  If the passed parameters
 *     don't match the flow won't build.
 * @publicapi
 */
export type BoxExecutiveDefinition = (
	serviceProvider: ServiceProvider,
	value: MessageData,
	emit: (chunk: MessageData[], priority?: number) => void
) => Promise<MessageData> | MessageData | Promise<any>

/**
 * Type of the code definition executing batches of the Box.
 *
 * The routine that contains the business logic of the Box.  The capability of the function are stated
 * in the metadata, namely *provides*, *emits* and *aggregates*.
 *
 * ### The box does not *aggregate*
 * - When called with `batch` only -> it serves as a mapper and *must* return (promise) of MessageData[],
 *   the mapped data being *in the same order* as the input data
 * - The batching box *can't serve* as a *generator*.
 *
 * ### The box *aggregates*
 * TODO: (idea1) how is the api for aggregation?
 *
 ** @param serviceParamsProvider A container holding built-in and used defined services (logger, statsd, ...) and
 *    run time parameters of the box.
 *    Your code can freely use the services, e.g. `serviceParamsProvider.get('logger').log(...)` or parameters
 *    `serviceParamsProvider.parameters`.
 * @param batch The array of data input into your box.  The data objects will have only those attributes that are
 *     explicitly required in the box metadata.  Your code can set any attributes to any message, but only those
 *     explicitly stated in the metadata will be confirmed.  The other will be discarded.
 * @param parameters The box can (but it does not have to) receive run-time parameters from the job.  The parameters
 *     are passed if and only if the box has properly defined validation scheme in metadata.  If the passed parameters
 *     don't match the flow won't build.
 *
 * @publicapi
 */
export type BoxExecutiveBatchDefinition = (
	serviceParamsProvider: ServiceProvider,
	batch: MessageData[]
) => Promise<MessageData[]> | MessageData[]

export type BoxFactorySignature = new (
	providedName: string,
	serviceParamsProvider: ServiceProvider,
	q?: PriorityQueueI<Message>
) => BoxInterface

export type BatchingBoxFactorySignature = new (
	providedName: string,
	serviceParamsProvider: ServiceProvider,
	q?: PriorityQueueI<Message>
) => BatchingBoxInterface
