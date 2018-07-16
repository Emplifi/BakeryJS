import {SchemaObject} from './IFlowBuilder';
import IFlowSchemaReader from './IFlowSchemaReader';

export default class FlowSchemaReader implements IFlowSchemaReader {
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
