import { AsyncPriorityQueue } from 'async';
import IFlowBuilder, {SerialSchemaComponent, SchemaObject, ConcurrentSchemaComponent} from '../IFlowBuilder';
import {IBox} from '../IBox';
import IComponentFactory from '../IComponentFactory';
import {Message, MessageData} from '../Message';
const async = require('async');

type InputProvider = (requires: string[]) => MessageData;
type OutputAcceptor = (provides: string[], value: MessageData) => void;

type ProcessingCallback = (getInput: InputProvider, setOutput: OutputAcceptor) => Promise<void> | void;

export class MilanBuilder implements IFlowBuilder {
    public async build(schema: SchemaObject, componentFactory: IComponentFactory): Promise<AsyncPriorityQueue<Message>> {
        return await this.buildPriorityQueue(schema, 'process', componentFactory);
    }

    private async buildConcurrentFunctions(concurrentSchema: ConcurrentSchemaComponent, componentFactory: IComponentFactory): Promise<ProcessingCallback[]> {
        const concurrentFunctions: ProcessingCallback[] = [];
        for (const boxName of concurrentSchema) {
            if (typeof boxName !== 'string') {
                for (const key of Object.keys(boxName)) {
                    const queue = await this.buildPriorityQueue(boxName, key, componentFactory);
                    const component: IBox<MessageData, MessageData> = await componentFactory.create(key, queue);
                    concurrentFunctions.push(async (getInput: InputProvider, setOutput: OutputAcceptor): Promise<void> => {
                        const results = await component.process(getInput(component.meta.requires));
                        setOutput(component.meta.provides, results);
                    })
                }
            } else {
                const component: IBox<MessageData, MessageData> = await componentFactory.create(boxName);
                concurrentFunctions.push(async (getInput: InputProvider, setOutput: OutputAcceptor): Promise<void> => {
                    const results = await component.process(getInput(component.meta.requires));
                    setOutput(component.meta.provides, results);
                })
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

    private async buildPriorityQueue(schema: SchemaObject, key: string, componentFactory: IComponentFactory): Promise<AsyncPriorityQueue<Message>> {
        const serialFunctions = await this.buildSerialFunctions(schema[key], componentFactory);
        return async.priorityQueue(
            async (task: Message): Promise<void> => {
                const getInput = (requires: string[]) => task.getInput(requires);
                const setOutput = (provides: string[], value: MessageData) => task.setOutput(provides, value);

                serialFunctions.reduce((previous: Promise<{input: InputProvider, output: OutputAcceptor}>, serialCallback: ProcessingCallback): Promise<{input: InputProvider, output: OutputAcceptor}> => {
                    // TODO: prvni fce se vykona, dalsi fce nepreda spravne params
                    return previous.then(async ({input, output}: {input: InputProvider, output: OutputAcceptor}): Promise<{input: InputProvider, output: OutputAcceptor}> => {
                        await serialCallback(input, output);
                        return {input, output};
                    });
                }, Promise.resolve({input: getInput, output: setOutput}));
            }
        , 10);
    }
}
