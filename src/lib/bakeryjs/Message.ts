import { Job } from "./Job"
const debug = require('debug')('bakeryjs:message');

export class Message {
    data:{[x:string]:any} = {}
    constructor(initData:{[x:string]:any}) {
        for (let p in initData) {
            this.data[p] = initData[p]
        }
    }
    getInput(requires:string[]):Object {
        const input:any = {}
        for (let r of requires) {
            input[r] = this.data[r]
        }
        debug("set input:"+JSON.stringify(input))
        return input
    }

    setOutput(provides:string[], output:any) {
        debug("set output:"+JSON.stringify(output))
        for (let p of provides) {
            this.data[p] = output[p]
        }
    }
}