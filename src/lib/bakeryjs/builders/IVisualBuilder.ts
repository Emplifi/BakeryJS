import {SchemaObject} from '../IFlowBuilder';

export interface IVisualBuilder {
	build(schema: SchemaObject): Promise<string> | string;
}
