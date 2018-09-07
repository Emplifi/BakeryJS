const debug = require('debug')('bakeryjs:message');

export type MessageData = {[key: string]: any};

let messageId = 0;

/**
 * ### Identifiable message
 *
 * The Identifiable with data and their accessors and the flag that the generation is not finished.
 */
interface IdMessage {
	readonly id: string;
	readonly parent: IdMessage | undefined;
	create(values: MessageData): IdMessage;
	createSentinel(retValue?: any): IdSentinel;
	getInput(requires: string[]): MessageData;
	setOutput(provides: string[], output: MessageData): void;

	/**
	 * ## Flag of the sentinel message.
	 *
	 * Denotes that this message carries generated data (and that other may follow).
	 */
	readonly finished: false;
}

/**
 * ### Sentinel message
 *
 * Imagine generation of *Messages* which are to be aggregated down the flow.  The aggregator has access to
 * the *id* of the Message the bunch belongs to but can't realize whether it has process all Messages to
 * the particular parent Message *id*.
 *
 * The *Sentinel Message* is the information. Though it has a unique *id* (as every other *Message*)
 * the information it is taking reads "I am the last" of the parent *id*.
 *
 * The field *data* has different semantics.  You can't access to fields of the parent *Message* through it.
 * It holds a *Return Value* of the generator -- `undefined`, Error instance, Warning instance, etc.
 */
interface IdSentinel {
	readonly id: string;
	readonly parent: IdMessage;
	readonly data: any;
	/**
	 * ## Flag of the sentinel message.
	 *
	 * Denotes finished generation with optional result value.  The *id* of the finished dimension is available
	 * in the field *id*.  Any relevant parent data are available in through *parent*.
	 *
	 * The result value (which can be `undefined`, instance of `TypeError`, etc.) is stored in the field `data`.
	 */
	readonly finished: true;
}

export type Message = IdMessage | IdSentinel;

/**
 * # Behaviour
 * 1. Object that is identified by an *id*. The *id* is unique at lest within the flow being currently executed.
 * 2. Such an object can have its parent, the object it has been generated from.
 * 3. A new descendant is created by calling the method *create*.
 *
 * # Intended use:
 * A Message is Identifiable.
 *
 * ## Joints of Edges
 * Several clones of the Message pass through the flow "in parallel".  We need to merge
 * these clones into a single Message, eventually.  As Messages can be (possibly) prioritized, we have to perform a join
 * with respect to *ids*.
 *
 * ## Generating Messages in a *Generator*
 * A generated Message must have an (abstract) link to its *parent* for the purpose of aggregation.  The *parent* *id* plays
 * a role of the GROUP BY expression.
 */
abstract class CIdentifiable {
	private readonly _id: string;
	public readonly parent: IdMessage | undefined;

	public get id(): string {
		return (this.parent ? `${this.parent.id};` : '') + '/' + this._id;
	}

	protected constructor(parent: IdMessage | undefined) {
		this._id = `${messageId++}`;
		this.parent = parent;
	}
}

export class SentinelMessage extends CIdentifiable implements IdSentinel {
	public readonly parent: IdMessage;
	public readonly data: any;
	public readonly finished: true = true;

	public constructor(retValue: any, parent: IdMessage) {
		super(parent);
		this.parent = parent; // WTF!!! without this, there is an error "My property parent is not set!"
		this.data = retValue;
	}
}

/**
 * One piece of data flowing inside the Flow through Boxes.
 *
 * - Message holds the computed information in fields.  The information in a field is *immutable* once written.
 * - As Message flows through Boxes, each Box adds one or more field with arbitrary information.
 * - The Box can't get access to other fields than it is *requiring*. (TODO: (code detail) throws TypeError?)
 * - The Box can set only fields that is *providing*. (TODO: (code detail) throws TypeError?)
 * - The trace of the Message passage is reported by the flow executor into an API passed into Program
 *
 * @internalapi
 */
export class DataMessage extends CIdentifiable implements IdMessage {
	protected data: MessageData;
	public readonly finished: false = false;

	public constructor(initData?: MessageData, parent?: IdMessage) {
		super(parent);
		this.data = initData ? initData : Object.create(null);
	}

	public create(values?: MessageData): IdMessage {
		const newData = values
			? Object.create(this.data, Object.getOwnPropertyDescriptors(values))
			: Object.create(this.data);
		return new DataMessage(newData, this);
	}

	public createSentinel(retValue?: any): IdSentinel {
		return new SentinelMessage(retValue, this);
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

export function isData(m: Message): m is IdMessage {
	return !m.finished;
}

export function isSentinel(m: Message): m is SentinelMessage {
	return m.finished;
}
