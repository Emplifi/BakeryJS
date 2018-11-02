import ComponentFactoryI from './ComponentFactoryI';
import FlowBuilderI, {FlowExplicitDescription} from './FlowBuilderI';
import {Flow} from './Flow';
import {PriorityQueueI} from './queue/PriorityQueueI';
import {Message} from './Message';

export default class FlowFactory {
	private readonly componentFactory: ComponentFactoryI;
	private readonly builder: FlowBuilderI;

	public constructor(
		componentFactory: ComponentFactoryI,
		builder: FlowBuilderI
	) {
		this.componentFactory = componentFactory;
		this.builder = builder;
	}

	public async create(
		schema: FlowExplicitDescription,
		drain?: PriorityQueueI<Message>
	): Promise<Flow> {
		return this.builder.build(schema, this.componentFactory, drain);
	}
}
