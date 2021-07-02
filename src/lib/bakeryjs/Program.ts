import {
	Flow,
	FlowDescription,
	FlowIdDescValidation,
	hasFlow,
	hasProcess,
} from './Flow';
import {Job} from './Job';
import {ServiceContainer, ServiceProvider} from './ServiceProvider';
import {ComponentFactory, MultiComponentFactory} from './ComponentFactory';
import {DefaultVisualBuilder} from './builders/DefaultVisualBuilder';
import {FlowCatalog} from './FlowCatalog';
import FlowSchemaReader from './FlowSchemaReader';
import {DataMessage, Message, MessageData} from './Message';
import {PriorityQueueI} from './queue/PriorityQueueI';
import {DAGBuilder} from './builders/DAGBuilder/builder';
import {eventEmitter} from './stats';
import ajv from 'ajv';
import {SchemaObjectValidation} from './FlowBuilderI';
import {MultiError} from 'verror';
import VError = require('verror');
const debug = require('debug')('bakeryjs:Program');

type UserConfiguration = {
	componentPaths?: string[];
};

type DrainCallback = (msg: MessageData) => void;
function createDrainPush(
	drainCallback: DrainCallback
): PriorityQueueI<Message> {
	return {
		push(msgs: DataMessage | DataMessage[], priority?: number) {
			if (Array.isArray(msgs)) {
				for (let i = 0; i < msgs.length; i++) {
					drainCallback(msgs[i].export());
				}
			} else {
				drainCallback(msgs.export());
			}
		},
		length: 0,
		target: 'drain',
	};
}

/**
 * - ToDo: (idea2) The Program must provide a means for collecting logs of the Boxes.
 * - ToDo: (idea2) The Program must provide a means for collecting performance/monitoring metrics.
 *
 * ## Intended use
 *
 * User imports `Program` from BakeryJS into her source code.  Into the instantiation she passes in the services:
 *  - logger: {log(message: any): void, error(message: any): void}
 *  - tracer
 *  - arbitrary user defined service
 *  - ... .
 *
 *  User -calls-an-appropriate-method-of- provides a `Program` with configuration defining path of her/his own boxes.
 *  ToDo: (code detail) In the future, it could be a plugin "FileBoxRepository".
 *  Todo: (idea2): User registers 3rd party (Git, npm module) box set.
 *
 * The `Program` has a method to ingest `Job`.  This method is called from the user's source code, and a valid Job
 *  -- the flow description (either flow name or flow schema) and the input data.  The method returns a Promise of response.
 *
 *  ## TODO: (idea1): Customization
 *  - flowBuilder (Promise Series of Parallel of Boxes / DAGBuilder)
 *  - flowRepository (FileFlowRepo, MongoFlowRepo, RedisFlowRepo, MemoryFlowRepo, ...)
 *  - edge prioritization
 *  - parallelization
 *
 * @publicapi
 */
export class Program {
	private readonly serviceProvider: ServiceProvider;
	private readonly multiComponentFactory: MultiComponentFactory;
	private readonly catalog: FlowCatalog;
	private readonly ajv: ajv.Ajv;
	private readonly id = Math.random().toString(36).substring(7);

	public constructor(
		serviceContainer: ServiceContainer,
		userConf: UserConfiguration
	) {
		console.time(`${this.id} - Program preparation`);
		// set default services
		this.serviceProvider = new ServiceProvider({
			logger: {
				log(message: any): void {
					console.log(message);
				},
				error(message: any): void {
					console.error(message);
				},
			},
		});

		// set the provided services, optionally overwriting the default
		this.serviceProvider.setAllIn(serviceContainer);

		// set the built-in component factory
		this.multiComponentFactory = new MultiComponentFactory();
		this.multiComponentFactory.push(
			new ComponentFactory(
				`${__dirname}/../../components/`,
				this.serviceProvider
			)
		);

		// set the provided component factories
		if (userConf.componentPaths) {
			userConf.componentPaths
				// we have to conserve priority of paths
				.reverse()
				.forEach((userPath) =>
					this.multiComponentFactory.push(
						new ComponentFactory(userPath, this.serviceProvider)
					)
				);
		}

		this.catalog = new FlowCatalog(
			new FlowSchemaReader(`${__dirname}/../../flows/flows`),
			this.multiComponentFactory,
			new DAGBuilder(),
			new DefaultVisualBuilder()
		);

		this.ajv = new ajv({
			schemas: [FlowIdDescValidation, SchemaObjectValidation],
		});
	}

	public on(eventName: string, callback: (...args: any[]) => any): void {
		eventEmitter.on(eventName, callback);
	}

	public async runFlow(
		flow: Flow,
		jobInitialValue?: MessageData
	): Promise<void> {
		const job = new Job(jobInitialValue);
		if (debug.enabled) {
			console.log('Program run ----->');
		}
		// TODO: separate this from stats EE -- it is shared accross various flows
		eventEmitter.emit('run', flow, job);
		console.timeEnd(`${this.id} - Program preparation`);
		console.time(`${this.id} - Program processing`);
		await flow.process(job);
		console.timeEnd(`${this.id} - Program processing`);

		// setTimeout(() => flow.process(new Job()),2000);
	}

	/**
	 * Runs a flow and receive messages that leave the flow through drain.
	 *
	 * @param flowDesc Description of the flow.
	 * @param drainCallback Drain.  Any box that is terminal in the flow (no other box consumes its output) outputs into
	 *     drain. Single message can enter drain multiple times (from each leaf of the flow graph).
	 * @param jobInitialValue Initial value (the very first message entering the flow).  Beware of conflicts with fields
	 *     provided by boxes in the flow.  The behaviour in conflict between initial value and provided value is
	 *     not defined.
	 *
	 * @returns promise of job being done
	 * @publicapi
	 */
	public async run(
		flowDesc: FlowDescription,
		drainCallback?: DrainCallback,
		jobInitialValue?: MessageData
	): Promise<void> {
		if (
			!this.ajv.validate(
				{
					oneOf: [
						{$ref: 'bakeryjs/flow'},
						{$ref: 'bakeryjs/flowbuilder'},
					],
				},
				flowDesc
			)
		) {
			const errs = this.ajv.errors;
			if (errs) {
				throw new VError(
					{
						name: 'JobValidationError',
						cause: new MultiError(
							errs
								.filter((e) => e.dataPath !== '')
								.map((e) => new VError(e.message))
						),
						info: {
							schema: [
								this.ajv.getSchema('bakeryjs/flowbuilder'),
								this.ajv.getSchema('bakeryjs/flow'),
							],
						},
					},
					'Job definition should match exactly one of the two schemes.',
					true
				);
			}
		}
		const drain = drainCallback
			? createDrainPush(drainCallback)
			: undefined;
		if (debug.enabled) {
			console.log('dispatch on flow description:');
		}
		if (hasFlow(flowDesc)) {
			if (debug.enabled) {
				console.log('getting flow from catalog');
			}
			const flow = await this.catalog.getFlow(flowDesc.flow, drain);
			await this.runFlow(flow, jobInitialValue);
		} else if (hasProcess(flowDesc)) {
			if (debug.enabled) {
				console.log('building flow from SchemaObject');
			}
			const flow = await this.catalog.buildFlow(flowDesc, drain);
			await this.runFlow(flow, jobInitialValue);
		} else {
			throw new TypeError(
				`Unrecognized flow description. ${JSON.stringify(flowDesc)}`
			);
		}
	}
}
