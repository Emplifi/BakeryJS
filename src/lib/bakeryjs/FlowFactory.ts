import type ComponentFactoryI from './ComponentFactoryI'
import type FlowBuilderI from './FlowBuilderI'
import type { FlowExplicitDescription } from './FlowBuilderI'
import type { Flow } from './Flow'
import type { PriorityQueueI } from './queue/PriorityQueueI'
import type { Message } from './Message'

export default class FlowFactory {
	private readonly componentFactory: ComponentFactoryI
	private readonly builder: FlowBuilderI

	public constructor(componentFactory: ComponentFactoryI, builder: FlowBuilderI) {
		this.componentFactory = componentFactory
		this.builder = builder
	}

	public async create(
		schema: FlowExplicitDescription,
		drain?: PriorityQueueI<Message>
	): Promise<Flow> {
		return this.builder.build(schema, this.componentFactory, drain)
	}
}
