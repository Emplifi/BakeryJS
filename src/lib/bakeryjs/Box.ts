import { AsyncPriorityQueue } from 'async';
import { IBox, BoxMeta } from './types/Box';

export abstract class Box<T,O> implements IBox<T,O> {
    name: string;
	q: any;
	// metadata: what I provide, what I require
	// needed to barely check the dependencies of the pipeline
	abstract meta: BoxMeta;
	// cleaning actions, e.g. disconnecting the DBs, cleaning internal cache, etc.
	clean?: {
		(): void;
	};

    protected constructor(name: string) {
        this.name = name;
    }

	// the processing function itself
	public abstract process(value: T): Promise<O> | O;

    setOutQueue(q: AsyncPriorityQueue<T>): void {
        this.q = q
    }
}
