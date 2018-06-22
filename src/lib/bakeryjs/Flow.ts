import { Job } from "./Job";
import {statSync,readdirSync} from 'fs'
import { AsyncPriorityQueue } from "async";
import { IBox } from "./types/Box";
import { Message } from "./Message";
import { Box } from "./Box";
const async = require('async');

type ProcessSchema = Array<SchemaParallelComponent>
type SchemaParallelComponent = Array<SchemaComponent>
type SchemaComponent = string|SchemaObject
interface ISchemaObject {
    [key: string]: ProcessSchema;
}
type SchemaObject = ISchemaObject

export class Flow {
    private availableComponents:{[s: string]: string} = {}
    public setup(componentsPath:string) {
        this.findComponents(componentsPath)
        console.log(this.availableComponents);
    }

    private queue:async.AsyncPriorityQueue<Message>|null = null
    public process(job:Job) {
        if (this.queue == null) {
            var a = setInterval( () => {
                console.log("waiting")
                if (this.queue != null) {
                    this.queue.push(new Message(job), 1);
                    clearInterval(a);
                }}
            ,100)
        } else {
            console.log("q exists");
            this.queue.push(new Message(job), 1);
        }
        
    }
    
    private buildParallels = async (cfg:SchemaParallelComponent) => {       
        const parallelFunctions:Function[] = []
        for (let boxName of cfg) {
            if (typeof boxName != "string") {
                for (let key of Object.keys(boxName)) {
                    const component:IBox<Message,Object> = await this.getComponent(key)
                    component.setOutQueue(await this.buildPriorityQueue(boxName, key))
                    console.log({generator:component})
                    parallelFunctions.push(async (getInput:Function, setOutput:Function) => { 
                        var results:Object = await component.process(getInput(component.meta.requires)) 
                        setOutput(component.meta.provides, results);                        
                    })
                }
            } else {
                const component:IBox<Message,Object> = await this.getComponent(boxName)
                parallelFunctions.push(async (getInput:Function, setOutput:Function) => { 
                    var results:Object = await component.process(getInput(component.meta.requires)) 
                    setOutput(component.meta.provides, results);
                })
            }
        }

        return parallelFunctions
    }

    private buildWaterfall = async (processLines:ProcessSchema) => {
        var waterfallFunctions:Promise<Function>[] = [];
        waterfallFunctions = processLines.map(async (pl:SchemaParallelComponent) => { 
            const parallelFunctions:Function[] = await this.buildParallels(pl)
            return async (args:Function[]) => {
                return await Promise.all(parallelFunctions.map((fn:Function) => fn(args[0],args[1])))
                
            }
        })

        return await Promise.all(waterfallFunctions)
    };

    private buildPriorityQueue = async (schema:SchemaObject, key:string) => {
        console.log("buildPriorityQueue: "+key)
        var waterFall = await this.buildWaterfall(schema[key])
        waterFall.map((x:Function)=>console.log("a:"+x.toString()))
        return async.priorityQueue(
            async (task:Message) => {
                const getInput = function (requires:string[]) {
                    return task.getInput(requires)
                };

                const setOutput = function (provides:string[], val:Message) {
                    task.setOutput(provides, val)
                };
                waterFall.reduce(function (prev:Promise<Function[]>, curr:any) {
                    // TODO: prvni fce se vykona, dalsi fce nepreda spravne params
                    return prev.then(curr);
                }, Promise.resolve([getInput, setOutput]))
            }
        , 10)
    }

    public build(schema:SchemaObject, parent:string = '') {
        this.buildPriorityQueue(schema, "process").then(
            (q) => this.queue = q
        )
    }

    private boxes:{[x:string]:IBox<Message,Object>} = {}

    private async getComponent(name:string) {
        if (this.boxes[name]) {
            return this.boxes[name]
        }
        var box = await import(this.availableComponents[name])
        this.boxes[name] = box.default(name)
        return this.boxes[name]
    }

    private findComponents(componentsPath:string, parentDir:string = '') {
        const files = readdirSync(componentsPath);
        files.forEach( (file:string) => {
            if (statSync(componentsPath + file).isDirectory()) {
                if (file != "." && file != "..") {
                    const child:string = file + '/'
                    this.findComponents(componentsPath + file + '/', parentDir + child)
                }
            }
            else {
                this.availableComponents[(parentDir + file).replace('boxes/', '').replace('_/', '').replace('processors/', '').replace('generators/', '').replace('.coffee', '').replace('.ts', '')] = componentsPath + file
            }
        })
    }

    public buildVisual(schema:SchemaObject, parent:string = '') {
        for (let key of Object.keys(schema)) {
            console.log(parent+key)
            parent += ' '
            console.log(parent+"Waterfall(")
            parent += ' '
            for (let waterfall of schema[key]) {
                console.log(parent+"Parallel(")
                parent += ' '
                for (let parallel of waterfall) {
                    if (typeof parallel !== "string") {
                        this.buildVisual(parallel, parent+' ')
                    } else {
                        console.log(' '+parent+parallel)
                    }
                }
                parent = parent.substr(1)
                console.log(parent+")")
            }
            parent = parent.substr(1)
            console.log(parent+")")
        }
    }
}
