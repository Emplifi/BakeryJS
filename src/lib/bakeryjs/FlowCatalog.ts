import {Flow} from './Flow';
import FlowSchemaReaderI from './FlowSchemaReaderI';
import FlowFactory from './FlowFactory';
import ComponentFactoryI from './ComponentFactoryI';
import FlowBuilderI, {FlowExplicitDescription} from './FlowBuilderI';
import {VisualBuilder} from './builders/VisualBuilder';
import {PriorityQueueI} from './queue/PriorityQueueI';
import {Message} from './Message';

const debug = require('debug')('bakeryjs:flowCatalog');

export class FlowCatalog {
	private readonly flowSchemaReader: FlowSchemaReaderI;
	private readonly flowFactory: FlowFactory;
	private readonly visualBuilder: VisualBuilder;

	public constructor(
		flowSchemaReader: FlowSchemaReaderI,
		componentFactory: ComponentFactoryI,
		builder: FlowBuilderI,
		visualBuilder: VisualBuilder
	) {
		this.flowSchemaReader = flowSchemaReader;
		this.visualBuilder = visualBuilder;
		this.flowFactory = new FlowFactory(componentFactory, builder);
	}

	public async getFlow(
		flowName: string,
		drain?: PriorityQueueI<Message>
	): Promise<Flow> {
		const schema = await this.flowSchemaReader.getFlowSchema(flowName);

		debug('getFlow: %s', flowName);
		return this.buildFlow(schema, drain);
	}

	public async buildFlow(
		schema: FlowExplicitDescription,
		drain?: PriorityQueueI<Message>
	): Promise<Flow> {
		if (debug.enabled || process.env.NODE_ENV !== 'production') {
			const visualSchema = await this.visualBuilder.build(schema);
			console.log(visualSchema);
		}
		return await this.flowFactory.create(schema, drain);
	}
}
