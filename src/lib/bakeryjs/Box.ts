import {
	BatchingBoxInterface,
	BatchingBoxMeta,
	BoxInterface,
	BoxMeta,
	OnCleanCallback,
} from './BoxI';
import {Message, MessageData} from './Message';
import {PriorityQueueI} from './queue/PriorityQueueI';
import VError from 'verror';
import {ServiceProvider} from './ServiceProvider';
import {AssertionError} from 'assert';
import ajv from 'ajv';
import {boxEvents} from './BoxEvents';
import {EventEmitter} from 'events';

export const noopQueue: PriorityQueueI<any> = {
	push: (msg: any, priority?: number) => undefined,
	length: 0,
	target: '',
};

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
) => Promise<MessageData> | MessageData | Promise<any>;

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
) => Promise<MessageData[]> | MessageData[];

export type BoxFactorySignature = new (
	providedName: string,
	serviceParamsProvider: ServiceProvider,
	q?: PriorityQueueI<Message>
) => BoxInterface;

export type BatchingBoxFactorySignature = new (
	providedName: string,
	serviceParamsProvider: ServiceProvider,
	q?: PriorityQueueI<Message>
) => BatchingBoxInterface;

/**
 * # Box
 *
 * Box is a basic operational unit.  Every operation on a [Message] is performed by a Box and conversely
 * a Message can be operated only in the Box.  The primary mean of the framework extension is by defining
 * new kinds of boxes.
 *
 * The operation is always considered asynchronous although it may operate synchronously.
 *
 * ## Means of operation
 *
 * The Box expects a Message (array of Messages) to receive with particular fields set.  These are *required* fields and
 * the Box must state them publicly in its metadata.  Similarly, the operation results in some new fields
 * *provided* by the Box that are **appended** to the Message.  The *provided* fields are stated publicly in
 * the metadata as well.
 *
 * ## Cardinality of the result
 *
 * The box can be in one of the following modes:
 *  > ### TODO: can be some particular box some time generator and some time a mapper
 *  > a -- dej mi prvnich 20 commentu vs. dej mi vsechny commenty -- vyhneme se "tupemu" aggregatoru typu "first"
 *  >
 *  > Should the generator/aggregator have different (extended) interface than a mapper?
 *  > Would it be "easy/simple" to extend the framework with new Boxes? Each type will be possibly treated
 *  > differently in the flow/builder.
 *
 *  1. A *mapper* -- it receives a Message (batch of Messages) and returns (asynchronously) a Message (batch of Messages) of the same
 *  size and of the same order.
 *  2. A *generator* -- a box receives a *single* Message and creates a sequence of batches of Messages
 *  that can be further directed in the flow.  Further in the flow, the Messages can be interspersed with respect to
 *  theirs parent in the Batch.
 *
 *  > ### TODO: pull iterations?  Modelled by queue with empty/full events and responses.
 *  > Both regimes are reasonable.
 *  > a. **push** -- e.g. clocks.  Once in a minute, new Message is *pushed* into the flow.  Or subscribed
 *  >  events from DB Query.
 *  > b. **pull** -- e.g. Iterate posts/comments from social network.  Get a batch and *pull* the next once
 *  >   the current has been just finished.  Having it *pushed* can consume my memory. Or a case where *pull*
 *  >   (the query) takes an argument that depends on the previous batch of data (I can't remember any example, though).
 *  >   Will be available through backpressure of the queues and (customized) high watermark to 1.
 *  >
 *  > Both can be modeled by a queue and generator responding/not responding to events "empty" and "full"
 *  >
 *
 *  > ### generator adds new **dimension** of data, it should be in metadata.
 *  >
 *  > In the beginning the job's data have 0 dimensions. It is only a "point" == a single job description info.
 *  > Further in the flow, a generator produces batches of FB posts, the job's data have single *dimension*
 *  > "posts".  All the Messages in all the batches share the same job describing keys and differ only in fields
 *  > specific to the single post, i.e. populating the "posts" dimension.  It doesn't matter whether the field
 *  > is directly generated by the generator or further derived in the flow from the one directly generated.
 *  > Each subsequent generator adds its dimension to the existing ones.
 *  > If a Box depends on result of other Boxes, the other Boxes must operate on the same dimension, and we should
 *  > be able to check it.
 *
 *  3. An *aggregator* -- a box is consuming batches of Messages grouping by the Message fields but those
 *  of the *dimension* added last.  When it consumes all the dimension for given "group by" fields, it produces
 *  batch of Messages whose dimension has just been consumed.
 *  > ### TODO: (idea2) How do we recognize all the dimension to some "group by" fields is consumed?
 *  >
 *  > in iterative (pull) flow, we recognize it by ordering.  How about push flow?
 *
 *  # Means of extension
 *
 * If I want to have a new Box, I have to
 * 1. (Re-)Define all services (logger, statsd, ...) and pass it to a Program
 * 2. Invoke boxFactory or boxBatchingFactory with properly set metadata and
 * 3. the function processValue executing my code
 *
 *
 * > ### the Box should provide a flag about the operation. Was it success?  Was it error? Was it not ideal but let's go on?
 * > * Logging is the bare basic.  Every event from the flow (i.e. BoxThrowsError, process termination, ...) must be logged
 *     into a logger.
 * > * https://www.npmjs.com/package/debug is the second option
 * > * tracing is the most advanced option
 * >
 * > When a box encounters an exception, it
 * > 1. Logs it into a logger
 * > 2. TODO: Sends the particular message (including the error) into error-drain (so that the user can explore it)
 * > 3. TODO: Stops the flow
 *
 * > ### TODO: (code detail) Box life-cycle and onClean actions.
 * >
 * > If Box reads from DB, who maintains connection? Box (and will dispose of it), or the BoxFactory
 * > (somewhere in catalog)?
 *
 * TODO: (code detail) the Box execution should be membraned (so that it can't alter the global entities)
 *
 * @internalapi
 */
abstract class Box extends EventEmitter implements BoxInterface {
	private readonly queue: PriorityQueueI<Message>;
	protected readonly serviceParamsProvider: ServiceProvider;
	public readonly name: string;
	public readonly meta: BoxMeta;
	public readonly onClean: OnCleanCallback[] = [];

	/**
	 * The Box is a basic unit of execution. It comprises of two levels:
	 * 1. Receiving layer from the flow (the method `process`).  Decomposes the Message, invokes `processValue` and
	 * reacts on its return.
	 *
	 * 2. Executing layer, meant to be overridden in subclasses.
	 *
	 * TODO: (idea2) The 1. layer should be moved into the flow executor.
	 *
	 * @param name
	 *  name/identifier of the box
	 * @param meta metadata of the Box.  Should be immutable.  One should be able to instantiate the Box without knowing \
	 * them. The created instance should have the metadata set.
	 * @param serviceProvider container of system & user defined services (logger, ...)
	 *
	 * @param queue - the output connection of the Box.  Everyone should push to that queue. Mapper, Generator, Aggregator.
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
		super();
		const {generatorTrace} = boxEvents(this);
		this.name = name;
		this.meta = meta;
		this.serviceParamsProvider = serviceProvider;
		this.queue = generatorTrace(
			queue || (noopQueue as PriorityQueueI<Message>),
			name
		);
		if (this.meta.parameters && parameters) {
			const ajvValidator = new ajv();
			if (ajvValidator.validate(this.meta.parameters, parameters)) {
				this.serviceParamsProvider = serviceProvider.addParameters(
					parameters
				);
			} else {
				const errs = ajvValidator.errors;
				throw new VError(
					{
						name: 'BoxParametersValidationError',
						info: {
							schema: this.meta.parameters,
							parameters: parameters,
							validationErrors: errs,
						},
					},
					'Box parameters must conform to the schema defined in the box. Schema: %s, parameters: %s',
					JSON.stringify(this.meta.parameters),
					JSON.stringify(parameters)
				);
			}
		} else {
			this.serviceParamsProvider = serviceProvider;
		}
	}

	protected neverEmitCallback(): void {
		throw new VError(
			{
				name: 'InconsistentBoxError',
				info: {
					name: this.name,
					meta: this.meta,
				},
			},
			"Box '%s': Can't invoke `emitCallback` unless being a generator/aggregator! Either set metadata filed 'emits' or 'aggregates'.",
			this.name
		);
	}

	private async processMapper(msg: Message): Promise<any> {
		try {
			const result = await this.processValue(
				msg.getInput(this.meta.requires),
				(chunk: MessageData[], priority?: number) =>
					this.neverEmitCallback()
			);
			msg.setOutput(this.meta.provides, result);
			this.queue.push(msg);
			return;
		} catch (error) {
			if (!(error instanceof Error)) {
				error = new Error(error.toString());
			}
			const wrap = new VError(
				{
					name: 'BoxInvocationException',
					cause: error,
					info: {
						mode: 'mapper',
						box: {
							name: this.name,
							meta: this.meta,
						},
						value: msg.getInput(this.meta.requires),
					},
				},
				"The box '%s' in a %s mode encountered an exception.",
				this.name,
				'mapper'
			);

			throw wrap;
		}
	}

	private async processGenerator(value: Message): Promise<any> {
		try {
			let siblingsCount = 0;
			// Prevent the queue from being pushed after generator has resolved
			const {guardQueue} = boxEvents(this);
			const guardedQ = guardQueue(this.queue);

			const retValue: any = await this.processValue(
				value.getInput(this.meta.requires),
				(chunk: MessageData[], priority?: number) => {
					siblingsCount += chunk.length;
					guardedQ.push(
						chunk.map((msg) => {
							const parent: Message = value.create();
							parent.setOutput(this.meta.provides, msg);
							return parent;
						}),
						priority
					);
				}
			);

			guardedQ.revoke();
			this.emit('generation_finished', [
				{
					boxName: this.name,
					messageId: value.id,
					parentMsgId: value.parent && value.parent.id,
					generated: siblingsCount,
				},
			]);
			// TODO: what to do with the retValue?
			// I might have stopped in the middle of generation due to external problems
			// (e.g. social network refuses to keep responding )
			return retValue;
		} catch (error) {
			if (
				error instanceof TypeError &&
				error.message.includes('revoked')
			) {
				throw new VError(
					{
						name: 'GeneratorMisbehaveException',
						info: {
							mode: 'generator',
							box: {
								name: this.name,
								meta: this.meta,
							},
							value: value.getInput(this.meta.requires),
							description:
								'Generator should return a promise that would be resolved once all the messages had been emitted.' +
								'  This error occurs when generator attempts to emit messages after its promise has been resolved.' +
								'  The code of the generator should be repaired to keep the contract.',
						},
					},
					'Generator %s emitted messages after its promise had been resolved.',
					this.name
				);
			}
			const wrap = new VError(
				{
					name: 'BoxInvocationException',
					cause: error,
					info: {
						mode: 'generator',
						box: {
							name: this.name,
							meta: this.meta,
						},
						value: value.getInput(this.meta.requires),
					},
				},
				"The box '%s' in a %s mode encountered an exception.",
				this.name,
				'generator'
			);

			throw wrap;
		}
	}

	private async processAggregator(msg: Message): Promise<any> {
		throw new VError(
			{
				name: 'NotImplementedError',
				message: "Box '%s': Aggregator has not been implemented yet.",
				info: {
					name: this.name,
					meta: this.meta,
				},
			},
			this.name
		);
	}

	/**
	 *  The processing function -- dispatcher on metadata information
	 *  invokes either `processAggregator` or `processMapper` or `processGenerator`
	 *
	 *  ## The operation
	 *
	 *  - the box is a *mapper*.  The DataMessage batch is passed into the mapper, the response
	 *     is awaited and pushed into the output queue.
	 *
	 *  - the box is a *generator*.  The DataMessages are *sequentially* passed into the generator.  The generator
	 *    is awaited, so that the processing of the batch is sequential.
	 *
	 *  - the box is an *aggregator*. The whole batch is sent into the aggregator.
	 *
	 * @param batch A Message[] to act on
	 * @returns Promise -- just an indication of finished processing
	 *
	 * @internalapi
	 */
	public async process(msg: Message): Promise<any> {
		const isGenerator: boolean = this.meta.emits.length > 0;
		const isAggregator: boolean = this.meta.aggregates;
		const isMapper: boolean = !isAggregator && !isGenerator;

		if (isAggregator) {
			return await this.processAggregator(msg);
		}

		try {
			if (isMapper) {
				return await this.processMapper(msg);
			} else if (isGenerator) {
				await this.processGenerator(msg);
				return true;
			} else {
				throw new AssertionError({
					message:
						'Box that is neither Mapper nor Generator nor Aggregator',
				});
			}
		} catch (error) {
			this.serviceParamsProvider.get('logger').error(error);
			// TODO: Stop processing (let it bubble up to the queue processor? And the queue then breaks the flow?)
			// TODO: Send the batch into error-drain
			return null;
		}
	}

	/**
	 * Type of the executing code of the Box's boilerplate.
	 *
	 * The routine that contains the business logic of the Box.  The capability of the function are stated
	 * in the metadata, namely *provides*, *emits* and *aggregates*.
	 *
	 * ### The box does not *aggregate*
	 * - When called with `value` only -> it serves as a mapper and *must* return (promise) of MessageData[],
	 * - when called with both `value` and `emit` -> it serves as a generator and
	 *   - each new message emits by calling `emit([data], priority?)`
	 *   - when finished with generating, resolves the returned Promise.  The resolved value is thrown away
	 *     the promise only marks the generation complete.
	 *   - If an error occurres, reject the returned Promise with an Error instance
	 *
	 * ### The box *aggregates*
	 * TODO: (idea1) how is the api for aggregation?
	 *
	 * @internalapi
	 */
	protected abstract processValue(
		msg: MessageData,
		emit: (batch: MessageData[], priority?: number) => void
	): Promise<MessageData> | MessageData | Promise<any>;
}

abstract class BatchingBox extends EventEmitter
	implements BatchingBoxInterface {
	public readonly name: string;
	public readonly meta: BatchingBoxMeta;
	public readonly onClean: OnCleanCallback[] = [];
	private readonly queue: PriorityQueueI<Message>;
	private readonly requireSet: Set<string>;
	protected readonly serviceParamsProvider: ServiceProvider;

	/**
	 * The Box is a basic unit of execution. It comprises of two levels:
	 * 1. Receiving layer from the flow (the method `process`).  Decomposes the Message, invokes `processValue` and
	 * reacts on its return.
	 *
	 * 2. Executing layer, meant to be overridden in subclasses.
	 *
	 * TODO: (idea2) The 1. layer should be moved into the flow executor.
	 *
	 * @param name
	 *  name/identifier of the box
	 * @param meta metadata of the Box.  Should be immutable.  One should be able to instantiate the Box without knowing \
	 * them. The created instance should have the metadata set.
	 * @param serviceProvider container of system & user defined services (logger, ...)
	 *
	 * @param queue - the output connection of the Box.  Everyone should push to that queue. Mapper, Generator, Aggregator.
	 */
	protected constructor(
		name: string,
		meta: BatchingBoxMeta,
		serviceProvider: ServiceProvider,
		queue?: PriorityQueueI<Message>,
		parameters?: any
	) {
		super();
		const {generatorTrace} = boxEvents(this);

		this.name = name;
		this.meta = meta;

		this.queue = generatorTrace(
			queue || (noopQueue as PriorityQueueI<Message>),
			name
		);
		this.requireSet = new Set(this.meta.requires);
		if (this.meta.parameters && parameters) {
			const ajvValidator = new ajv();
			if (ajvValidator.validate(this.meta.parameters, parameters)) {
				this.serviceParamsProvider = serviceProvider.addParameters(
					parameters
				);
			} else {
				const errs = ajvValidator.errors;
				throw new VError(
					{
						name: 'BoxParametersValidationError',
						info: {
							schema: this.meta.parameters,
							parameters: parameters,
							validationErrors: errs,
						},
					},
					'Box parameters must conform to the schema defined in the box. Schema: %s, parameters: %s',
					JSON.stringify(this.meta.parameters),
					JSON.stringify(parameters)
				);
			}
		} else {
			this.serviceParamsProvider = serviceProvider;
		}
	}

	private async processMapper(batch: Message[]): Promise<any> {
		try {
			const result = await this.processValue(
				// Entering the user-defined code.  Let's handle a case when the box
				// requests batching but the code treats the input as a single message.
				new Proxy(
					batch.map((msg) => msg.getInput(this.meta.requires)),
					{
						get: (target: MessageData[], prop: any, receiver) => {
							if (
								this.requireSet.has(prop) &&
								!Number.isInteger(prop) &&
								!Array.prototype[prop]
							) {
								throw new VError(
									{
										name: 'BatchError',
										info: {
											property: prop,
										},
									},
									'Accessing property %s on the whole batch.  Probably the box requires batching but the executive code assumes single message.',
									prop
								);
							} else {
								return Reflect.get(target, prop, receiver);
							}
						},
					}
				)
			);
			this.queue.push(
				result.map((msg: MessageData, index: number) => {
					batch[index].setOutput(this.meta.provides, msg);
					return batch[index];
				})
			);
			return;
		} catch (error) {
			if (!(error instanceof Error)) {
				error = new Error(error.toString());
			}
			const wrap = new VError(
				{
					name: 'BoxInvocationException',
					cause: error,
					info: {
						mode: 'mapper',
						box: {
							name: this.name,
							meta: this.meta,
						},
						batch: batch.map((msg) =>
							msg.getInput(this.meta.requires)
						),
					},
				},
				"The box '%s' in a %s mode encountered an exception.",
				this.name,
				'mapper'
			);

			throw wrap;
		}
	}

	private async processAggregator(batch: Message[]): Promise<any> {
		throw new VError(
			{
				name: 'NotImplementedError',
				message: "Box '%s': Aggregator has not been implemented yet.",
				info: {
					name: this.name,
					meta: this.meta,
				},
			},
			this.name
		);
	}

	/**
	 *  The processing function -- dispatcher on metadata information
	 *  invokes either `processAggregator` or `processMapper` or `processGenerator`
	 *
	 *  ## The operation
	 *
	 *  - the box is a *mapper*.  The DataMessage batch is passed into the mapper, the response
	 *     is awaited and pushed into the output queue.
	 *
	 *  - the box is a *generator*.  The DataMessages are then *sequentially* passed into the generator.  The generator
	 *    is awaited, so that the processing of the batch is sequential.
	 *
	 *  - the box is an *aggregator*. The whole batch is sent into the aggregator.
	 *
	 * @param batch A Message[] to act on
	 * @returns Promise -- just an indication of finished processing
	 *
	 * @internalapi
	 */
	public async process(batch: Message[]): Promise<any> {
		const isAggregator: boolean = this.meta.aggregates;
		const isMapper = !isAggregator;

		if (isAggregator) {
			return await this.processAggregator(batch);
		}

		const data = batch;
		if (data.length > 0) {
			try {
				if (isMapper) {
					return await this.processMapper(data);
				} else {
					throw new AssertionError({
						message:
							'BatchingBox that is neither aggregator nor mapper!',
					});
				}
			} catch (error) {
				this.serviceParamsProvider.get('logger').error(error);
				// TODO: Stop processing (let it bubble up to the queue processor? And the queue then breaks the flow?)
				// TODO: Send the batch into error-drain
				return null;
			}
		}
	}

	/**
	 * Type of the executing code of the Box's boilerplate.
	 *
	 * The routine that contains the business logic of the Box.  The capability of the function are stated
	 * in the metadata, namely *provides*, *emits* and *aggregates*.
	 *
	 * ### The box does not *aggregate*
	 * - When called with `value` only -> it serves as a mapper and *must* return (promise) of MessageData[],
	 * - when called with both `value` and `emit` -> it serves as a generator and
	 *   - each new message emits by calling `emit([data], priority?)`
	 *   - when finished with generating, resolves the returned Promise.  The resolved value is thrown away
	 *     the promise only marks the generation complete.
	 *   - If an error occurres, reject the returned Promise with an Error instance
	 *
	 * ### The box *aggregates*
	 * TODO: (idea1) how is the api for aggregation?
	 *
	 * @internalapi
	 */
	protected abstract processValue(
		msgBatch: MessageData[]
	): Promise<MessageData[]> | MessageData[] | Promise<any>;
}

/**
 * A basic mean of creating your own boxes.
 *
 * Each box has to be in its own file, the filename being the box's identificator (name).
 * The file is a JS (TS) module that `exports default` the return value of `boxFactory`.
 *
 * @param metadata Information about intended operation of the code. This is an information
 *    the framework decides upon about the invocation of your box code.
 * @param processValueDef The code of your box.
 * @returns a box model.  It must be the *default export* of the module.
 *
 * @internalapi
 */
function boxSingleFactory(
	metadata: BoxMeta,
	processValueDef: BoxExecutiveDefinition
): BoxFactorySignature {
	return class extends Box {
		public constructor(
			providedName: string,
			serviceProvider: ServiceProvider,
			q?: PriorityQueueI<Message>,
			parameters?: any
		) {
			super(providedName, metadata, serviceProvider, q, parameters);
		}
		protected processValue(
			msg: MessageData,
			emit: (msgs: MessageData[], priority?: number) => void
		) {
			return processValueDef(this.serviceParamsProvider, msg, emit);
		}
	};
}

/**
 * A basic mean of creating your own boxes.
 *
 * Each box has to be in its own file, the filename being the box's identificator (name).
 * The file is a JS (TS) module that `exports default` the return value of `boxBatchingFactory`.
 *
 * @param metadata Information about intended operation of the code. This is an information
 *    the framework decides upon about the invocation of your box code.  As the box should
 *    operate in batching mode, don't forgett to specify *batch* data.
 * @param processValueDef The code of your box.
 * @returns a box model.  It must be the *default export* of the module.
 *
 * @internalapi
 */
function boxBatchingFactory(
	metadata: BatchingBoxMeta,
	processValueDef: BoxExecutiveBatchDefinition
): BatchingBoxFactorySignature {
	return class extends BatchingBox {
		public constructor(
			providedName: string,
			serviceProvider: ServiceProvider,
			q?: PriorityQueueI<Message>,
			parameters?: any
		) {
			super(providedName, metadata, serviceProvider, q, parameters);
		}
		protected processValue(msgs: MessageData[]) {
			return processValueDef(this.serviceParamsProvider, msgs);
		}
	};
}

/**
 * A basic mean of creating your own boxes.
 *
 * Each box has to be in its own file, the filename being the box's identificator (name).
 * The file is a JS (TS) module that `exports default` the return value of `boxFactory`.
 *
 * @param metadata Information about intended operation of the code. This is an information
 *    the framework decides upon about the invocation of your box code.
 * @param processValueDef The code of your box.
 * @returns a box model.  It must be the *default export* of the module.
 *
 * @publicapi
 */
export function boxFactory(
	metadata: BoxMeta | BatchingBoxMeta,
	processValueDef: BoxExecutiveDefinition | BoxExecutiveBatchDefinition
): BoxFactorySignature | BatchingBoxFactorySignature {
	if ((metadata as BatchingBoxMeta).batch) {
		return boxBatchingFactory(
			metadata as BatchingBoxMeta,
			processValueDef as BoxExecutiveBatchDefinition
		);
	} else {
		return boxSingleFactory(
			metadata as BoxMeta,
			processValueDef as BoxExecutiveDefinition
		);
	}
}
