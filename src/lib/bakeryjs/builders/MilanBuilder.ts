import FlowBuilderI, {
	ConcurrentSchemaComponent,
	SchemaObject,
	SerialSchemaComponent,
} from '../FlowBuilderI';
import {BoxInterface} from '../BoxI';
import ComponentFactoryI from '../ComponentFactoryI';
import {PriorityQueueI} from '../queue/PriorityQueueI';
import {Message} from '../Message';
import {MemoryPriorityQueue} from '../queue/MemoryPriorityQueue';

type ProcessingCallback = (msg: Message) => Promise<void> | void;

export class MilanBuilder implements FlowBuilderI {
	public async build(
		schema: SchemaObject,
		componentFactory: ComponentFactoryI,
		drain?: PriorityQueueI<Message>
	): Promise<PriorityQueueI<Message>> {
		return await this.buildPriorityQueue(
			schema,
			'process',
			componentFactory,
			drain
		);
	}

	private async createConcurrentFunction(
		componentFactory: ComponentFactoryI,
		name: string,
		queue?: PriorityQueueI<Message>
	) {
		const component: BoxInterface = await componentFactory.create(
			name,
			queue
		);
		return (msg: Message): Promise<void> => component.process([msg]);
	}

	private async buildConcurrentFunctions(
		concurrentSchema: ConcurrentSchemaComponent,
		componentFactory: ComponentFactoryI,
		drain?: PriorityQueueI<Message>
	): Promise<ProcessingCallback[]> {
		const concurrentFunctions: ProcessingCallback[] = [];
		for (const boxName of concurrentSchema) {
			if (typeof boxName !== 'string') {
				for (const key of Object.keys(boxName)) {
					const queue = await this.buildPriorityQueue(
						boxName,
						key,
						componentFactory,
						drain
					);
					concurrentFunctions.push(
						await this.createConcurrentFunction(
							componentFactory,
							key,
							queue
						)
					);
				}
			} else {
				concurrentFunctions.push(
					await this.createConcurrentFunction(
						componentFactory,
						boxName
					)
				);
			}
		}

		return concurrentFunctions;
	}

	private async buildSerialFunctions(
		serialSchema: SerialSchemaComponent,
		componentFactory: ComponentFactoryI,
		drain?: PriorityQueueI<Message>
	): Promise<ProcessingCallback[]> {
		const serialFunctions: Promise<ProcessingCallback>[] = serialSchema.map(
			async (
				schema: ConcurrentSchemaComponent
			): Promise<ProcessingCallback> => {
				const concurrentFunctions: ProcessingCallback[] = await this.buildConcurrentFunctions(
					schema,
					componentFactory,
					drain
				);
				return async (msg: Message): Promise<void> => {
					await Promise.all(
						concurrentFunctions.map(
							(processCbk: ProcessingCallback) => processCbk(msg)
						)
					);
				};
			}
		);

		return await Promise.all(serialFunctions);
	}

	private async buildPriorityQueue(
		schema: SchemaObject,
		key: string,
		componentFactory: ComponentFactoryI,
		drain?: PriorityQueueI<Message>
	): Promise<PriorityQueueI<Message>> {
		const serialFunctions: ProcessingCallback[] = await this.buildSerialFunctions(
			schema[key],
			componentFactory,
			drain
		);
		return new MemoryPriorityQueue(
			async (task: Message): Promise<void> => {
				const appliedFcns = serialFunctions.reduce(
					(
						previous: Promise<Message>,
						serialCallback: ProcessingCallback
					): Promise<Message> => {
						// TODO: (code later) prvni fce se vykona, dalsi fce nepreda spravne params
						return previous.then(
							async (msg: Message): Promise<Message> => {
								await serialCallback(msg);
								return msg;
							}
						);
					},
					Promise.resolve(task)
				);

				if (drain) {
					appliedFcns.then(
						(msg: Message): void => {
							drain.push(msg);
						}
					);
				}
			},
			10,
			'__root__'
		);
	}
}
