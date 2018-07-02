const debug = require('debug')('bakeryjs:message');

export type MessageData = {[key: string]: any};

export class Message {
    data: MessageData = {};

    constructor(initData: MessageData) {
        for (const p in initData) {
            this.data[p] = initData[p];
        }
    }

    getInput(requires: string[]): MessageData {
        const input: MessageData = {};
        for (const r of requires) {
            input[r] = this.data[r];
        }
        debug(`set input: ${JSON.stringify(input)}`);

        return input;
    }

    setOutput(provides: string[], output: MessageData): void {
        debug(`set output: ${JSON.stringify(output)}`);
        for (const p of provides) {
            this.data[p] = output[p];
        }
    }
}
