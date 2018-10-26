import {Flow} from './Flow';
import FlowSchemaReaderI from './FlowSchemaReaderI';
import FlowFactory from './FlowFactory';
import ComponentFactoryI from './ComponentFactoryI';
import FlowBuilderI, {FlowExplicitDescription} from './FlowBuilderI';
import {VisualBuilder} from './builders/VisualBuilder';
import {PriorityQueueI} from './queue/PriorityQueueI';
import {Message} from './Message';

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

		console.log(`getFlow: ${flowName}`);
		return this.buildFlow(schema, drain);
	}

	public async buildFlow(
		schema: FlowExplicitDescription,
		drain?: PriorityQueueI<Message>
	): Promise<Flow> {
		console.log(await this.visualBuilder.build(schema));

		return await this.flowFactory.create(schema, drain);
	}
}
