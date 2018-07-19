import IFlowBuilder, {ConcurrentSchemaComponent, SchemaObject, SerialSchemaComponent} from '../IFlowBuilder';
import {IBox} from '../IBox';
import IComponentFactory from '../IComponentFactory';
import {IPriorityQueue} from '../queue/IPriorityQueue';
import {DataMessage, Message, MessageData} from '../Message';
import {MemoryPriorityQueue} from '../queue/MemoryPriorityQueue';

type InputProvider = (requires: string[]) => MessageData;
type OutputAcceptor = (provides: string[], value: MessageData) => void;

type ProcessingCallback = (getInput: InputProvider, setOutput: OutputAcceptor) => Promise<void> | void;

export class MilanBuilder implements IFlowBuilder {
    public async build(schema: SchemaObject, componentFactory: IComponentFactory): Promise<IPriorityQueue<Message>> {
        return await this.buildPriorityQueue(schema, 'process', componentFactory);
    }

    private async createConcurrentFunction(componentFactory: IComponentFactory, name: string, queue?: IPriorityQueue<Message>) {
        const component: IBox<MessageData, MessageData> = await componentFactory.create(name, queue);
        return async (getInput: InputProvider, setOutput: OutputAcceptor): Promise<void> => {
            const results = await component.process(getInput(component.meta.requires));
            setOutput(component.meta.provides, results);
        };
    }

    private async buildConcurrentFunctions(concurrentSchema: ConcurrentSchemaComponent, componentFactory: IComponentFactory): Promise<ProcessingCallback[]> {
        const concurrentFunctions: ProcessingCallback[] = [];
        for (const boxName of concurrentSchema) {
            if (typeof boxName !== 'string') {
                for (const key of Object.keys(boxName)) {
                    const queue = await this.buildPriorityQueue(boxName, key, componentFactory);
                    concurrentFunctions.push(await this.createConcurrentFunction(componentFactory, key, queue))
                }
            } else {
                concurrentFunctions.push(await this.createConcurrentFunction(componentFactory, boxName))
            }
        }

        return concurrentFunctions;
    }

    private async buildSerialFunctions(serialSchema: SerialSchemaComponent, componentFactory: IComponentFactory): Promise<ProcessingCallback[]> {
        const serialFunctions: Promise<ProcessingCallback>[] = serialSchema.map(async (schema: ConcurrentSchemaComponent): Promise<ProcessingCallback> => {
            const concurrentFunctions = await this.buildConcurrentFunctions(schema, componentFactory);
            return async (getInput: InputProvider, setOutput: OutputAcceptor): Promise<void> => {
                await Promise.all(concurrentFunctions.map((processingCallback: ProcessingCallback) => processingCallback(getInput, setOutput)));
            }
        });

        return await Promise.all(serialFunctions);
    }

    private async buildPriorityQueue(schema: SchemaObject, key: string, componentFactory: IComponentFactory): Promise<IPriorityQueue<Message>> {
        const serialFunctions = await this.buildSerialFunctions(schema[key], componentFactory);
        return new MemoryPriorityQueue(
            async (task: DataMessage): Promise<void> => {
                const getInput = (requires: string[]): MessageData => task.getInput(requires);
                const setOutput = (provides: string[], value: MessageData): void => task.setOutput(provides, value);

				serialFunctions.reduce((previous: Promise<{input: InputProvider, output: OutputAcceptor}>, serialCallback: ProcessingCallback): Promise<{input: InputProvider, output: OutputAcceptor}> => {
					// TODO: (code later) prvni fce se vykona, dalsi fce nepreda spravne params
					return previous.then(async ({input, output}: {input: InputProvider, output: OutputAcceptor}): Promise<{input: InputProvider, output: OutputAcceptor}> => {
						await serialCallback(input, output);
						return {input, output};
					});
				}, Promise.resolve({input: getInput, output: setOutput}));
			}
		, 10);
	}
}
