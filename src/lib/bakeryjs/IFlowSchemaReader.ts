import {SchemaObject} from './IFlowBuilder';

export default interface IFlowSchemaReader {
	getFlowSchema(name: string): Promise<SchemaObject> | SchemaObject;
}
