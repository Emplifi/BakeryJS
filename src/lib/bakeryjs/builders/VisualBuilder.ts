import {FlowExplicitDescription} from '../FlowBuilderI';

export interface VisualBuilder {
	build(schema: FlowExplicitDescription): Promise<string> | string;
}
