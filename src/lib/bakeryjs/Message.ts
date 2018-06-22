const debug = require('debug')('bakeryjs:message');

export class Message {
    data: {[key: string]: any} = {};

    constructor(initData: {[key: string]: any}) {
        for (const p in initData) {
            this.data[p] = initData[p];
        }
    }

    getInput(requires: string[]): Message {
        const input: any = {};
        for (const r of requires) {
            input[r] = this.data[r];
        }
        debug(`set input: ${JSON.stringify(input)}`);

        return input;
    }

    setOutput(provides: string[], output: any): void {
        debug(`set output: ${JSON.stringify(output)}`);
        for (const p of provides) {
            this.data[p] = output[p];
        }
    }
}
