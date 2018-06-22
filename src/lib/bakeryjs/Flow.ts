import { AsyncPriorityQueue } from 'async';
import { Job } from './Job';
import { Message } from './Message';
import ComponentProvider from './ComponentProvider';
import IFlowBuilder, {SchemaObject} from './IFlowBuilder';

export class Flow {
    private readonly componentProvider: ComponentProvider;
    private builder: IFlowBuilder;
    private queue: AsyncPriorityQueue<Message> | null = null;

    constructor(componentProvider: ComponentProvider, builder: IFlowBuilder) {
        this.componentProvider = componentProvider;
        this.builder = builder;
    }

    public process(job: Job): void {
        if (this.queue == null) {
            const a = setInterval( () => {
                if (this.queue != null) {
                    this.queue.push(new Message(job), 1);
                    clearInterval(a);
                }}
            ,100);
        } else {
            this.queue.push(new Message(job), 1);
        }
    }

    public async build(schema: SchemaObject): Promise<void> {
        this.queue = await this.builder.build(schema, this.componentProvider);
    }
}
