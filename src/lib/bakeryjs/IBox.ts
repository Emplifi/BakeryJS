import {AsyncPriorityQueue} from 'async';
import {MessageData} from './Message';

export type BoxMeta = {
	provides: string[],
	requires: string[],
	batch?: {
		maxSize?: number,
		timeoutSeconds?: number,
	},
};

export type OnCleanCallback = () => (Promise<void> | void);

export interface IBox<T extends MessageData, O extends MessageData> {
	queue?: AsyncPriorityQueue<T>;
	// metadata: what I provide, what I require
	// needed to barely check the dependencies of the pipeline
	meta: BoxMeta;
	// cleaning actions, e.g. disconnecting the DBs, cleaning internal cache, etc.
	onClean: OnCleanCallback[];
	// the processing function itself
	process(value: T): Promise<O> | O
	setOutQueue(queue: AsyncPriorityQueue<T>): void
}
