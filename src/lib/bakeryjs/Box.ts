import { AsyncPriorityQueue } from 'async';
import {BoxMeta, IBox, OnCleanCallback} from './IBox';
import {MessageData} from './Message';

export abstract class Box<T extends MessageData, O extends MessageData> implements IBox<T, O> {
    name: string;
	queue?: AsyncPriorityQueue<T>;
	// metadata: what I provide, what I require
	// needed to barely check the dependencies of the pipeline
	abstract meta: BoxMeta;
	// cleaning actions, e.g. disconnecting the DBs, cleaning internal cache, etc.
	onClean: OnCleanCallback[];

    protected constructor(name: string) {
        this.name = name;
        this.onClean = [];
    }

	// the processing function itself
	public abstract process(value: T): Promise<O> | O;

    setOutQueue(queue: AsyncPriorityQueue<T>): void {
        this.queue = queue;
    }
}
