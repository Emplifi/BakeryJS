import {SchemaObject} from '../FlowBuilderI';

export interface VisualBuilder {
	build(schema: SchemaObject): Promise<string> | string;
}
