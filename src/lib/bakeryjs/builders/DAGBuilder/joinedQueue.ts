import {PriorityQueueI} from '../../queue/PriorityQueueI';
import {Options, VError} from 'verror';
import {Message} from '../../Message';
import assert from 'assert';
import {qTrace} from '../../stats';

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
export class Tee<T> implements PriorityQueueI<T> {
	private queues: PriorityQueueI<T>[];
	public readonly target: string;
	public readonly length: number = 0;
	public source: string | undefined;
	public constructor(...queues: PriorityQueueI<T>[]) {
		assert(queues.length > 0, "Can't tee into zero queues!");
		this.queues = queues;
		this.target = '';
	}

	@qTrace(false)
	public push(pld: T, priority?: number) {
		try {
			this.queues.forEach((q: PriorityQueueI<T>) =>
				q.push(pld, priority)
			);
		} catch (err) {
			throw new VError(
				{
					name: 'QueueOperationError',
					cause: err,
				} as Options,
				'Push into a queue failed.'
			);
		}
	}
}

class FakeQueue implements PriorityQueueI<Message> {
	private qzip: QZip;
	private readonly index: number;
	public readonly target: string;
	public source: string | undefined;

	public constructor(qzip: QZip, index: number, target: string) {
		this.qzip = qzip;
		this.index = index;
		this.target = target;
	}

	@qTrace(false)
	public push(msgs: Message | Message[], priority?: number) {
		if (msgs instanceof Array) {
			//TODO: fragile detection. What if Message is instanceof Array?
			msgs.forEach((msg) => this.qzip._push(this.index, msg, priority));
		} else {
			return this.qzip._push(this.index, msgs, priority);
		}
	}

	public get length() {
		return this.qzip.length;
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
	 * 1. a table input_number -> arrived,
	 * 2. the aggregated priority*/
	private readonly msgJoinedState: {
		[index: string]: {
			flags: Array<boolean>;
			priority: number | undefined;
		};
	};

	/** The queue-like input interfaces */
	public readonly inputs: PriorityQueueI<Message>[];
	/** Number of inputs being joined. */
	public get size() {
		return this.inputs.length;
	}

	public get length() {
		return Object.entries(this.msgJoinedState).length;
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

		this.inputs = Array(inputs)
			.fill(undefined, 0)
			.map((_, k: number) => new FakeQueue(this, k, this.output.target));
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
	public _push(idxOfInput: number, msg: Message, priority?: number): void {
		const state =
			this.msgJoinedState[msg.id] ||
			(this.msgJoinedState[msg.id] = {
				flags: Array(this.size).fill(false, 0),
				priority: undefined,
			});

		state.flags[idxOfInput] = true;
		if (priority !== undefined) {
			state.priority = Math.max(
				priority,
				state.priority !== undefined ? state.priority : -Infinity
			);
		}
		if (state.flags.every((val) => val)) {
			this.output.push(msg, state.priority);
			delete this.msgJoinedState[msg.id];
		}
	}
}
