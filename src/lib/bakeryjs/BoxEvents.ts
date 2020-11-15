import {DataMessage, Message} from './Message';
import {PriorityQueueI} from './queue/PriorityQueueI';
import {EventEmitter} from 'events';

interface RevocableQueue extends PriorityQueueI<Message> {
	revoke(): void;
}

export type MsgEvent = {
	boxName: string;
	messageId: string;
	parentMsgId: string | undefined;
	generated?: number;
};

type ModuleOutput = {
	generatorTrace: (
		priorityQ: PriorityQueueI<Message>,
		boxName: string
	) => PriorityQueueI<Message>;
	guardQueue: (priorityQ: PriorityQueueI<Message>) => RevocableQueue;
};

export function boxEvents(flowEmitter: EventEmitter): ModuleOutput {
	/**
	 * Wraps a `push` method of the queue to emit tracing information about pushed
	 * messages.  Intended to track emitted messages in generators.
	 *
	 * To ensure it captures only messages generated before the generator
	 * resolves and not those emitted later, it uses revocable proxy.
	 *
	 * @param priorityQ - The priority queue to wrap
	 * @returns priorityQ with method `push` shadowed and a method for revocation
	 */
	function generatorTrace(
		priorityQ: PriorityQueueI<Message>,
		boxName: string
	): PriorityQueueI<Message> {
		function tracedPush(
			msgs: DataMessage[] | DataMessage,
			priority?: number
		): void {
			let messages: DataMessage[];
			if (!Array.isArray(msgs)) {
				messages = [msgs];
			} else {
				messages = msgs;
			}

			priorityQ.push.apply(priorityQ, [msgs, priority]);
			const messagesTrace: MsgEvent[] = messages.map((m) =>
				Object.create(null, {
					boxName: {value: boxName},
					messageId: {value: m.id},
					parentMsgId: {value: m.parent && m.parent.id},
				})
			);
			flowEmitter.emit('msg_finished', messagesTrace);
		}

		return Object.create(priorityQ, {
			push: {value: tracedPush},
		});
	}

	function guardQueue(priorityQ: PriorityQueueI<Message>): RevocableQueue {
		// Prevent errors when generator (wrongly) resolves before emits have finished
		// Make pushing into queue through proxy and revoke it once generator resolves
		// Any push after will result in TypeError
		const {proxy, revoke} = Proxy.revocable(priorityQ.push, {
			apply: (tgt, thisArg, argsList) => {
				Reflect.apply(tgt, priorityQ, argsList);
			},
		});
		return Object.create(priorityQ, {
			push: {value: proxy},
			revoke: {value: revoke},
		});
	}

	return {generatorTrace, guardQueue};
}
