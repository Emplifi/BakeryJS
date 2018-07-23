import ComponentFactoryI from './ComponentFactoryI';
import FlowBuilderI, {SchemaObject} from './FlowBuilderI';
import {Flow} from './Flow';

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

	public async create(schema: SchemaObject): Promise<Flow> {
		return new Flow(
			await this.builder.build(schema, this.componentFactory)
		);
	}
}
