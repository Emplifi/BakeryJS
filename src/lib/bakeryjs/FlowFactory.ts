import IComponentProvider from './IComponentProvider';
import IFlowBuilder, {SchemaObject} from './IFlowBuilder';
import {Flow} from './Flow';

export default class FlowFactory {
    private readonly componentProvider: IComponentProvider;
    private readonly builder: IFlowBuilder;

    constructor(componentProvider: IComponentProvider, builder: IFlowBuilder) {
        this.componentProvider = componentProvider;
        this.builder = builder;
    }

    public async create(schema: SchemaObject): Promise<Flow> {
        return new Flow(await this.builder.build(schema, this.componentProvider));
    }
}
