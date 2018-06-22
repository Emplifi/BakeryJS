import { AsyncPriorityQueue } from 'async';
import { IBox } from '../types/Box';
import IFlowBuilder, {SerialSchemaComponent, SchemaObject, ConcurrentSchemaComponent} from '../IFlowBuilder';
import { Message } from '../Message';
import IComponentProvider from '../IComponentProvider';
const async = require('async');

type InputProvider = (requires: string[]) => Message;
type OutputAcceptor = (provides: string[], value: Message) => void;

type ProcessingCallback = (getInput: InputProvider, setOutput: OutputAcceptor) => Promise<void> | void;

export class MilanBuilder implements IFlowBuilder {
    public async build(schema: SchemaObject, componentProvider: IComponentProvider): Promise<AsyncPriorityQueue<Message>> {
        return await this.buildPriorityQueue(schema, 'process', componentProvider);
    }

    private async buildConcurrentFunctions(concurrentSchema: ConcurrentSchemaComponent, componentProvider: IComponentProvider): Promise<ProcessingCallback[]> {
        const concurrentFunctions: ProcessingCallback[] = [];
        for (const boxName of concurrentSchema) {
            if (typeof boxName !== 'string') {
                for (const key of Object.keys(boxName)) {
                    const component: IBox<Message, Message> = await componentProvider.getComponent(key);
                    component.setOutQueue(await this.buildPriorityQueue(boxName, key, componentProvider));
                    concurrentFunctions.push(async (getInput: InputProvider, setOutput: OutputAcceptor) => {
                        const results = await component.process(getInput(component.meta.requires));
                        setOutput(component.meta.provides, results);
                    })
                }
            } else {
                const component: IBox<Message, Message> = await componentProvider.getComponent(boxName);
                concurrentFunctions.push(async (getInput: InputProvider, setOutput: OutputAcceptor) => {
                    const results = await component.process(getInput(component.meta.requires));
                    setOutput(component.meta.provides, results);
                })
            }
        }

        return concurrentFunctions;
    }

    private async buildSerialFunctions(serialSchema: SerialSchemaComponent, componentProvider: IComponentProvider): Promise<ProcessingCallback[]> {
        const serialFunctions: Promise<ProcessingCallback>[] = serialSchema.map(async (schema: ConcurrentSchemaComponent): Promise<ProcessingCallback> => {
            const concurrentFunctions = await this.buildConcurrentFunctions(schema, componentProvider);
            return async (getInput: InputProvider, setOutput: OutputAcceptor): Promise<void> => {
                await Promise.all(concurrentFunctions.map((processingCallback: ProcessingCallback) => processingCallback(getInput, setOutput)));
            }
        });

        return await Promise.all(serialFunctions);
    }

    private async buildPriorityQueue(schema: SchemaObject, key: string, componentProvider: IComponentProvider): Promise<AsyncPriorityQueue<Message>> {
        const serialFunctions = await this.buildSerialFunctions(schema[key], componentProvider);
        return async.priorityQueue(
            async (task: Message) => {
                const getInput = (requires: string[]) => task.getInput(requires);
                const setOutput = (provides: string[], value: Message) => task.setOutput(provides, value);

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

    public buildVisual(schema: SchemaObject, parent: string = ''): void {
        for (const key of Object.keys(schema)) {
            console.log(`${parent}${key}`);
            parent += ' ';
            console.log(`${parent}Waterfall(`);
            parent += ' ';
            for (const serial of schema[key]) {
                console.log(`${parent}Parallel(`);
                parent += ' ';
                for (const concurrent of serial) {
                    if (typeof concurrent !== 'string') {
                        this.buildVisual(concurrent, `${parent} `);
                    } else {
                        console.log(` ${parent}${concurrent}`);
                    }
                }
                parent = parent.substr(1);
                console.log(`${parent})`);
            }
            parent = parent.substr(1);
            console.log(`${parent})`);
        }
    }
}
