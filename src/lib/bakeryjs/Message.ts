const debug = require('debug')('bakeryjs:message');

export type MessageData = {[key: string]: any};

let messageId = 0;

/**
 * ### Identifiable message
 *
 * The Identifiable with data and their accessors and the flag that the generation is not finished.
 */
export interface Message {
	readonly id: string;
	readonly parent: Message | undefined;
	create(values?: MessageData): Message;
	getInput(requires: string[]): MessageData;
	setOutput(provides: string[], output: MessageData): void;
}

/**
 * One piece of data flowing inside the Flow through Boxes.
 *
 * # Behaviour
 * 1. Object that is identified by an *id*. The *id* is unique at lest within the flow being currently executed.
 * 2. Such an object can have its parent, the object it has been generated from.
 * 3. A new descendant is created by calling the method *create*.
 *
 * # Intended use:
 * - A Message is Identifiable.
 * - Message holds the computed information in fields.  The information in a field is *immutable* once written.
 * - As Message flows through Boxes, each Box adds one or more field with arbitrary information.
 * - The trace of the Message passage is reported by the flow executor into an API passed into Program
 *
 * ## Joints of Edges
 * Several clones of the Message pass through the flow "in parallel".  We need to merge
 * these clones into a single Message, eventually.  As Messages can be (possibly) prioritized, we have to perform a join
 * with respect to *ids*.
 *
 * ## Generating Messages in a *Generator*
 * A generated Message must have an (abstract) link to its *parent* for the purpose of aggregation.  The *parent* *id* plays
 * a role of the GROUP BY expression. The trace of the Message passage is reported by the flow executor into an API passed into Program
 *
 * @internalapi
 */
export class DataMessage implements Message {
	private readonly _id: string;
	protected data: MessageData;
	public readonly parent: Message | undefined;

	public constructor(initData?: MessageData, parent?: Message) {
		this._id = `${messageId++}`;
		this.parent = parent;
		this.data = initData ? initData : {};
	}

	public get id(): string {
		return (this.parent ? `${this.parent.id}` : '') + '/' + this._id;
	}

	public create(values?: MessageData): Message {
		const newData = values
			? Object.create(this.data, Object.getOwnPropertyDescriptors(values))
			: Object.create(this.data);
		return new DataMessage(newData, this);
	}

	// TODO: (code detail) the flow executor should create a Data Access Object that will guard the fields and
	// pass the DAO into the box.  The factory of the DAO could be a method of the Message.
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
		const intersectionKeys = currentKeys.filter(
			(key: string) => provides.indexOf(key) !== -1
		);
		if (intersectionKeys.length > 0) {
			throw new Error(
				`Cannot provide some data because the message already contains following results "${intersectionKeys.join(
					'", "'
				)}".`
			);
		}

		debug(`set output: ${JSON.stringify(output)}`);
		for (const p of provides) {
			this.data[p] = output[p];
		}
	}

	public export(): MessageData {
		const protoChain: MessageData[] = [];
		let obj = this.data;
		while (obj !== Object.prototype) {
			protoChain.unshift(obj);
			obj = Object.getPrototypeOf(obj) as MessageData;
		}
		return Object.assign({}, ...protoChain);
	}
}
