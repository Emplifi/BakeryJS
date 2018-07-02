import IComponentFactory from './IComponentFactory';
import IFlowBuilder, {SchemaObject} from './IFlowBuilder';
import {Flow} from './Flow';

export default class FlowFactory {
    private readonly componentFactory: IComponentFactory;
    private readonly builder: IFlowBuilder;

    constructor(componentFactory: IComponentFactory, builder: IFlowBuilder) {
        this.componentFactory = componentFactory;
        this.builder = builder;
    }

    public async create(schema: SchemaObject): Promise<Flow> {
        return new Flow(await this.builder.build(schema, this.componentFactory));
    }
}
