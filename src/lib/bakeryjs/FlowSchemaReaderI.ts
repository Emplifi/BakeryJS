import {SchemaObject} from './FlowBuilderI';

export default interface FlowSchemaReaderI {
	getFlowSchema(name: string): Promise<SchemaObject> | SchemaObject;
}
