import { Flow } from './Flow';
import IFlowSchemaReader from './IFlowSchemaReader';
import FlowFactory from './FlowFactory';
import IComponentFactory from './IComponentFactory';
import IFlowBuilder from './IFlowBuilder';

export class FlowCatalog {
    private readonly flowSchemaReader: IFlowSchemaReader;
    private readonly builder: IFlowBuilder;
    private readonly flowFactory: FlowFactory;

    constructor(flowSchemaReader: IFlowSchemaReader, componentFactory: IComponentFactory, builder: IFlowBuilder) {
        this.flowSchemaReader = flowSchemaReader;
        this.builder = builder;
        this.flowFactory = new FlowFactory(componentFactory, builder);
    }

    async getFlow(flowName: string): Promise<Flow> {
        const schema = await this.flowSchemaReader.getFlowSchema(flowName);

        console.log(`getFlow: ${flowName}`);

        await this.builder.buildVisual(schema);

        return await this.flowFactory.create(schema);
    }
}
