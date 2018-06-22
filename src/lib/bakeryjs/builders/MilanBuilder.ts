import { AsyncPriorityQueue } from 'async';
import { IBox } from '../types/Box';
import IFlowBuilder, {SerialSchemaComponent, SchemaObject, ConcurrentSchemaComponent} from '../IFlowBuilder';
import { Message } from '../Message';
import IComponentProvider from '../IComponentProvider';
const async = require('async');

export class MilanBuilder implements IFlowBuilder {
    public async build(schema: SchemaObject, componentProvider: IComponentProvider): Promise<AsyncPriorityQueue<Message>> {
        return await this.buildPriorityQueue(schema, 'process', componentProvider);
    }

    private async buildConcurrentFunctions(concurrentSchema: ConcurrentSchemaComponent, componentProvider: IComponentProvider): Promise<Function[]> {
        const concurrentFunctions: Function[] = [];
        for (const boxName of concurrentSchema) {
            if (typeof boxName !== 'string') {
                for (const key of Object.keys(boxName)) {
                    const component: IBox<Message,Object> = await componentProvider.getComponent(key);
                    component.setOutQueue(await this.buildPriorityQueue(boxName, key, componentProvider));
                    concurrentFunctions.push(async (getInput: Function, setOutput: Function) => {
                        const results: Object = await component.process(getInput(component.meta.requires));
                        setOutput(component.meta.provides, results);
                    })
                }
            } else {
                const component: IBox<Message,Object> = await componentProvider.getComponent(boxName);
                concurrentFunctions.push(async (getInput: Function, setOutput: Function) => {
                    const results: Object = await component.process(getInput(component.meta.requires));
                    setOutput(component.meta.provides, results);
                })
            }
        }

        return concurrentFunctions;
    }

    private async buildSerialFunctions(serialSchema: SerialSchemaComponent, componentProvider: IComponentProvider): Promise<Function[]> {
        const serialFunctions: Promise<Function>[] = serialSchema.map(async (schema: ConcurrentSchemaComponent) => {
            const concurrentFunctions: Function[] = await this.buildConcurrentFunctions(schema, componentProvider);
            return async (args: Function[]) => {
                return await Promise.all(concurrentFunctions.map((fn: Function) => fn(args[0], args[1])));
            }
        });

        return await Promise.all(serialFunctions);
    }

    private async buildPriorityQueue(schema: SchemaObject, key: string, componentProvider: IComponentProvider): Promise<AsyncPriorityQueue<Message>> {
        const waterFall = await this.buildSerialFunctions(schema[key], componentProvider);
        return async.priorityQueue(
            async (task: Message) => {
                const getInput = (requires: string[]) => task.getInput(requires);
                const setOutput = (provides: string[], val: Message) => task.setOutput(provides, val);

                waterFall.reduce((prev: Promise<Function[]>, curr: any) => {
                    // TODO: prvni fce se vykona, dalsi fce nepreda spravne params
                    return prev.then(curr);
                }, Promise.resolve([getInput, setOutput]));
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
