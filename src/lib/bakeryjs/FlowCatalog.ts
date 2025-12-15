import type { Flow } from './Flow'
import type FlowSchemaReaderI from './FlowSchemaReaderI'
import FlowFactory from './FlowFactory'
import type ComponentFactoryI from './ComponentFactoryI'
import type FlowBuilderI from './FlowBuilderI'
import type { FlowExplicitDescription } from './FlowBuilderI'
import type { VisualBuilder } from './builders/VisualBuilder'
import type { PriorityQueueI } from './queue/PriorityQueueI'
import type { Message } from './Message'
import Debug from 'debug'

const debug = Debug('bakeryjs:flowCatalog')

export class FlowCatalog {
	private readonly flowSchemaReader: FlowSchemaReaderI
	private readonly flowFactory: FlowFactory
	private readonly visualBuilder: VisualBuilder

	public constructor(
		flowSchemaReader: FlowSchemaReaderI,
		componentFactory: ComponentFactoryI,
		builder: FlowBuilderI,
		visualBuilder: VisualBuilder
	) {
		this.flowSchemaReader = flowSchemaReader
		this.visualBuilder = visualBuilder
		this.flowFactory = new FlowFactory(componentFactory, builder)
	}

	public async getFlow(flowName: string, drain?: PriorityQueueI<Message>): Promise<Flow> {
		const schema = await this.flowSchemaReader.getFlowSchema(flowName)

		debug('getFlow: %s', flowName)
		return this.buildFlow(schema, drain)
	}

	public async buildFlow(
		schema: FlowExplicitDescription,
		drain?: PriorityQueueI<Message>
	): Promise<Flow> {
		if (debug.enabled) {
			const visualSchema = await this.visualBuilder.build(schema)
			console.log(visualSchema)
		}
		return await this.flowFactory.create(schema, drain)
	}
}
