import { AsyncPriorityQueue } from 'async';

interface BoxMeta {
	provides: string[];
	requires: string[];
	"batch.maxSize"?: number;
	"batch.timeoutSec"?: number;
}

interface IBox<T,O> {
	q: any;
	// metadata: what I provide, what I require
	// needed to barely check the dependencies of the pipeline
	meta: BoxMeta;
	// cleaning actions, e.g. disconnecting the DBs, cleaning internal cache, etc.
	clean?: {
		(): void;
	};
	// the processing function itself
	process(value: T): Promise<O> | O
	setOutQueue(q: AsyncPriorityQueue<T>): void
}
