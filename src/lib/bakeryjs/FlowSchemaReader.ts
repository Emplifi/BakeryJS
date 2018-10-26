import {FlowExplicitDescription} from './FlowBuilderI';
import FlowSchemaReaderI from './FlowSchemaReaderI';

export default class FlowSchemaReader implements FlowSchemaReaderI {
	private readonly flowList: {[key: string]: FlowExplicitDescription};

	public constructor(flowsPath: string) {
		this.flowList = require(flowsPath).default;
	}

	// TODO: (idea2) Lazy read from file upon request?
	public getFlowSchema(name: string): FlowExplicitDescription {
		if (!this.flowList[name]) {
			throw new Error(`Flow not found: ${name}`);
		}

		return this.flowList[name];
	}
}
