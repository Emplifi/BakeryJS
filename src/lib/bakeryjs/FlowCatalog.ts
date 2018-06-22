import { Flow } from './Flow';

export class FlowCatalog {
    componentsPath: string;
    flowList: any;

    constructor(componentsPath: string, flowsPath: string) {
        this.componentsPath = componentsPath;
        this.flowList = require(flowsPath).default;
    }

    async getFlow(flowName: string): Promise<Flow> {
        if (!this.flowList[flowName]) {
            throw new Error(`Flow not found: ${flowName}`);
        }
        console.log(`getFlow: ${flowName}`);

        const flow = new Flow();
        flow.setup(this.componentsPath);
        flow.buildVisual(this.flowList[flowName]);
        await flow.build(this.flowList[flowName]);

        return flow;
    }
}
