const debug = require('debug')('bakeryjs:message');

export type MessageData = {[key: string]: any};

let messageId = 0;

/**
 * One piece of data flowing inside the Flow through Boxes.
 *
 * - Message holds the computed information in fields.  The information in a field is *immutable* once written.
 * - As Message flows through Boxes, each Box adds one or more field with arbitrary information.
 * - The Box can't get access to other fields than it is *requiring*. (TODO: throws TypeError?)
 * - The Box can set only fields that is *providing*. (TODO: throws TypeError?)
 *
 * ## TODO: Special attributes Trace (and Log)?
 * - Message has a special attribute that is holding a trace (how was the flow through)
 * - Every pass through a Box writes a trace info into this special attribute.
 *
 * @internalapi
 */
export class Message {
    private readonly data: MessageData = {};

    public constructor(initData: MessageData) {
        this.data.messageId = `${messageId++}`;
        for (const p in initData) {
            this.data[p] = initData[p];
        }
    }

    public getInput(requires: string[]): MessageData {
        const input: MessageData = {};
        for (const r of requires) {
            input[r] = this.data[r];
        }
        debug(`set input: ${JSON.stringify(input)}`);

        return input;
    }

    public setOutput(provides: string[], output: MessageData): void {
        const currentKeys = Object.keys(this.data);
        const intersectionKeys = currentKeys.filter((key: string) => provides.indexOf(key) !== -1);
        if (intersectionKeys.length > 0) {
            throw new Error(`Cannot provide some data because the message already contains following results "${intersectionKeys.join('", "')}".`);
        }

        debug(`set output: ${JSON.stringify(output)}`);
        for (const p of provides) {
            this.data[p] = output[p];
        }
    }
}
