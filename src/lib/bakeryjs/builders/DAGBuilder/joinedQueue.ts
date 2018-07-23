import {PriorityQueueI} from '../../queue/PriorityQueueI';
import {Options, VError} from 'verror';
import {Message} from '../../Message';
import assert = require('assert');

/**
 * Assume one has several queues already set up.  We wan't a queue-like endpoint
 * such that when one *pushes* into it, the payload gets pushed into each of
 * the queues.
 *
 * @param queues Already set up queues.  The payload will be delivered into each.
 * If *push* to anyone fails, en exception is thrown.
 *
 * @throws VError QueueOperationError exception with field *cause*
 */
export function tee<T>(...queues: PriorityQueueI<T>[]): PriorityQueueI<T> {
	assert(queues.length > 0, "Can't tee into zero queues!");
	return {
		push(pld: T, priority?: number) {
			try {
				queues.forEach((q: PriorityQueueI<T>) => q.push(pld, priority));
			} catch (err) {
				throw new VError(
					{
						name: 'QueueOperationError',
						cause: err,
					} as Options,
					'Push into a queue failed.'
				);
			}
		},
	};
}

function* genEmpty(size: number): IterableIterator<undefined> {
	for (let k = 0; k < size; k++) {
		yield undefined;
	}
}

/**
 * # Zip (merge/join) two or more queues into one.
 *
 * Builds several queue-like inputs and outputs to a given queue.
 *
 * Every *Message* flowing is identifiable through its *id*.  The class holds a hash-map of the incoming Messages
 * remembering which inputs they came through. As a message comes through all inputs, remove it from the hash-map
 * and send it to output.
 *
 * If the message comes with different priority through each of inputs, it is pushed with the maximal one.
 * Undefined priorities are ignored.
 *
 * Expect the number of *inputs* > 1.
 */
export class QZip {
	/** The output queue */
	private readonly output: PriorityQueueI<Message>;

	/** Hash-map holding state of each *Message*. The *key* is Message.id, the value
	 * is
	 * 1. a table input_numer -> arrived,
	 * 2. the aggregated priority*/
	private readonly msgJoinedState: {
		[index: string]: {
			flags: Array<true | undefined>;
			priority: number | undefined;
		};
	};

	/** The queue-like input interfaces */
	public readonly inputs: PriorityQueueI<Message>[];
	/** Number of inputs being joined. */
	public get size() {
		return this.inputs.length;
	}

	/**
	 *
	 * @param output A queue that the joined message leaves for.
	 * @param inputs How many inputs are we going to join?  Must be > 1.
	 */
	public constructor(output: PriorityQueueI<Message>, inputs: number) {
		assert(inputs > 1, 'Not going to join/merge/zip less then 2 inputs.');
		this.msgJoinedState = {};
		this.output = output;

		this.inputs = Array.from(genEmpty(inputs)).map(
			(_, k: number) =>
				Object.create(null, {
					push: {
						value: (msg: Message, priority?: number) =>
							this._push(k, msg, priority),
						configurable: false,
						writable: false,
					},
				}) as PriorityQueueI<Message>,
			this
		);
	}

	/**
	 * This method is invoked upon `push` to any input queue-like interface.
	 * 1. Ensures the message is in the hash-map.
	 * 2. Sets a flag of the input the message came from
	 * 3. If all flags are set, push the message into output and remove it from the hash map.
	 *
	 * @param idxOfInput Which input did the message come from? It is the index into `this.inputs`.
	 * @param msg  The message that came.
	 * @param priority Priority the message came with
	 * @private
	 */
	private _push(idxOfInput: number, msg: Message, priority?: number): void {
		const state =
			this.msgJoinedState[msg.id] ||
			(this.msgJoinedState[msg.id] = {
				flags: Array.from(genEmpty(this.size)),
				priority: undefined,
			});

		state.flags[idxOfInput] = true;
		if (priority !== undefined) {
			state.priority = Math.max(
				priority,
				state.priority !== undefined ? state.priority : -Infinity
			);
		}
		if (state.flags.every((val) => val === true)) {
			this.output.push(msg, state.priority);
			delete this.msgJoinedState[msg.id];
		}
	}
}
