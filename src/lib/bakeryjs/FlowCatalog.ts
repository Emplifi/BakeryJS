import {Flow} from './Flow';
import IFlowSchemaReader from './IFlowSchemaReader';
import FlowFactory from './FlowFactory';
import IComponentFactory from './IComponentFactory';
import IFlowBuilder from './IFlowBuilder';
import {IVisualBuilder} from './builders/IVisualBuilder';

export class FlowCatalog {
    private readonly flowSchemaReader: IFlowSchemaReader;
    private readonly flowFactory: FlowFactory;
    private readonly visualBuilder: IVisualBuilder;

    public constructor(flowSchemaReader: IFlowSchemaReader, componentFactory: IComponentFactory, builder: IFlowBuilder, visualBuilder: IVisualBuilder) {
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
