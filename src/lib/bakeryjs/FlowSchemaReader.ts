import {SchemaObject} from './FlowBuilderI';
import FlowSchemaReaderI from './FlowSchemaReaderI';

export default class FlowSchemaReader implements FlowSchemaReaderI {
	private readonly flowList: {[key: string]: SchemaObject};

	public constructor(flowsPath: string) {
		this.flowList = require(flowsPath).default;
	}

	public getFlowSchema(name: string): SchemaObject {
		if (!this.flowList[name]) {
			throw new Error(`Flow not found: ${name}`);
		}

		return this.flowList[name];
	}
}
