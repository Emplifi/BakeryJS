import {Flow} from './Flow';
import FlowSchemaReaderI from './FlowSchemaReaderI';
import FlowFactory from './FlowFactory';
import ComponentFactoryI from './ComponentFactoryI';
import FlowBuilderI from './FlowBuilderI';
import {VisualBuilder} from './builders/VisualBuilder';

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

	public async getFlow(flowName: string): Promise<Flow> {
		const schema = await this.flowSchemaReader.getFlowSchema(flowName);

		console.log(`getFlow: ${flowName}`);

		console.log(await this.visualBuilder.build(schema));

		return await this.flowFactory.create(schema);
	}
}
