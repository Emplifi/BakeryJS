import { Job } from './Job';
import {statSync,readdirSync} from 'fs'
import { IBox } from './types/Box';
import { Message } from './Message';
const async = require('async');

type ProcessSchema = Array<SchemaParallelComponent>;
type SchemaParallelComponent = Array<SchemaComponent>;
type SchemaComponent = string | SchemaObject;
interface ISchemaObject {
    [key: string]: ProcessSchema;
}
type SchemaObject = ISchemaObject;

export class Flow {
    private availableComponents:{[s: string]: string} = {};
    private queue: async.AsyncPriorityQueue<Message> | null = null;
    private boxes: {[key: string]: IBox<Message, Object>} = {};

    public setup(componentsPath: string): void {
        this.findComponents(componentsPath);
        console.log(this.availableComponents);
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
    
    private async buildParallels(cfg: SchemaParallelComponent): Promise<Function[]> {
        const parallelFunctions: Function[] = [];
        for (const boxName of cfg) {
            if (typeof boxName !== 'string') {
                for (const key of Object.keys(boxName)) {
                    const component:IBox<Message,Object> = await this.getComponent(key);
                    component.setOutQueue(await this.buildPriorityQueue(boxName, key));
                    parallelFunctions.push(async (getInput:Function, setOutput:Function) => { 
                        const results: Object = await component.process(getInput(component.meta.requires));
                        setOutput(component.meta.provides, results);                        
                    })
                }
            } else {
                const component: IBox<Message,Object> = await this.getComponent(boxName);
                parallelFunctions.push(async (getInput:Function, setOutput:Function) => { 
                    const results: Object = await component.process(getInput(component.meta.requires));
                    setOutput(component.meta.provides, results);
                })
            }
        }

        return parallelFunctions;
    }

    private async buildWaterfall(processLines: ProcessSchema): Promise<Function[]> {
        const waterfallFunctions: Promise<Function>[] = processLines.map(async (pl: SchemaParallelComponent) => {
            const parallelFunctions:Function[] = await this.buildParallels(pl);
            return async (args: Function[]) => {
                return await Promise.all(parallelFunctions.map((fn:Function) => fn(args[0], args[1])));
            }
        });

        return await Promise.all(waterfallFunctions);
    };

    private async buildPriorityQueue(schema: SchemaObject, key: string): Promise<async.AsyncPriorityQueue<Message>> {
        const waterFall = await this.buildWaterfall(schema[key]);
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

    public async build(schema: SchemaObject, parent: string = ''): Promise<void> {
        this.queue = await this.buildPriorityQueue(schema, 'process');
    }

    private async getComponent(name: string): Promise<IBox<Message, Object>> {
        if (this.boxes[name]) {
            return this.boxes[name]
        }
        const box = await import(this.availableComponents[name]);
        this.boxes[name] = box.default(name);

        return this.boxes[name];
    }

    private findComponents(componentsPath: string, parentDir: string = ''): void {
        const files = readdirSync(componentsPath);
        files.forEach( (file: string) => {
            if (statSync(`${componentsPath}${file}`).isDirectory()) {
                if (file !== '.' && file !== '..') {
                    const child: string = `${file}/`;
                    this.findComponents(`${componentsPath}${file}/`, `${parentDir}${child}`);
                }
            } else {
                this.availableComponents[
                    `${parentDir}${file}`
                        .replace('boxes/', '')
                        .replace('_/', '')
                        .replace('processors/', '')
                        .replace('generators/', '')
                        .replace('.coffee', '')
                        .replace('.ts', '')
                ] = `${componentsPath}${file}`;
            }
        })
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
