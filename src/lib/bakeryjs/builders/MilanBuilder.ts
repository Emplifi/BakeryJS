import { AsyncPriorityQueue } from 'async';
import { IBox } from '../types/Box';
import IFlowBuilder, {ProcessSchema, SchemaObject, SchemaParallelComponent} from '../IFlowBuilder';
import { Message } from '../Message';
import IComponentProvider from '../IComponentProvider';
const async = require('async');

export class MilanBuilder implements IFlowBuilder {
    public async build(schema: SchemaObject, componentProvider: IComponentProvider): Promise<AsyncPriorityQueue<Message>> {
        return await this.buildPriorityQueue(schema, 'process', componentProvider);
    }

    private async buildParallels(cfg: SchemaParallelComponent, componentProvider: IComponentProvider): Promise<Function[]> {
        const parallelFunctions: Function[] = [];
        for (const boxName of cfg) {
            if (typeof boxName !== 'string') {
                for (const key of Object.keys(boxName)) {
                    const component:IBox<Message,Object> = await componentProvider.getComponent(key);
                    component.setOutQueue(await this.buildPriorityQueue(boxName, key, componentProvider));
                    parallelFunctions.push(async (getInput:Function, setOutput:Function) => {
                        const results: Object = await component.process(getInput(component.meta.requires));
                        setOutput(component.meta.provides, results);
                    })
                }
            } else {
                const component: IBox<Message,Object> = await componentProvider.getComponent(boxName);
                parallelFunctions.push(async (getInput:Function, setOutput:Function) => {
                    const results: Object = await component.process(getInput(component.meta.requires));
                    setOutput(component.meta.provides, results);
                })
            }
        }

        return parallelFunctions;
    }

    private async buildWaterfall(processLines: ProcessSchema, componentProvider: IComponentProvider): Promise<Function[]> {
        const waterfallFunctions: Promise<Function>[] = processLines.map(async (pl: SchemaParallelComponent) => {
            const parallelFunctions:Function[] = await this.buildParallels(pl, componentProvider);
            return async (args: Function[]) => {
                return await Promise.all(parallelFunctions.map((fn:Function) => fn(args[0], args[1])));
            }
        });

        return await Promise.all(waterfallFunctions);
    }

    private async buildPriorityQueue(schema: SchemaObject, key: string, componentProvider: IComponentProvider): Promise<AsyncPriorityQueue<Message>> {
        const waterFall = await this.buildWaterfall(schema[key], componentProvider);
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
            for (const waterfall of schema[key]) {
                console.log(`${parent}Parallel(`);
                parent += ' ';
                for (const parallel of waterfall) {
                    if (typeof parallel !== 'string') {
                        this.buildVisual(parallel, `${parent} `);
                    } else {
                        console.log(` ${parent}${parallel}`);
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
