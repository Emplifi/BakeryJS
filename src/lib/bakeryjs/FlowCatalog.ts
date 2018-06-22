import { Flow } from './Flow';
import ComponentProvider from './ComponentProvider';
import {MilanBuilder} from './builders/MilanBuilder';
import {SchemaObject} from './IFlowBuilder';

export class FlowCatalog {
    componentsPath: string;
    flowList: {[key: string]: SchemaObject};

    constructor(componentsPath: string, flowsPath: string) {
        this.componentsPath = componentsPath;
        this.flowList = require(flowsPath).default;
    }

    async getFlow(flowName: string): Promise<Flow> {
        if (!this.flowList[flowName]) {
            throw new Error(`Flow not found: ${flowName}`);
        }
        console.log(`getFlow: ${flowName}`);

        const builder = new MilanBuilder();
        const flow = new Flow(
            new ComponentProvider(this.componentsPath),
            builder
        );
        builder.buildVisual(this.flowList[flowName]);
        await flow.build(this.flowList[flowName]);

        return flow;
    }
}
