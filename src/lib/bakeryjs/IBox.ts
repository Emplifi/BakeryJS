import {MessageData} from './Message';

export type BoxMeta = {
	provides: string[],
	requires: string[],
	emits: string[],
	batch?: {
		maxSize?: number,
		timeoutSeconds?: number,
	},
};

export type OnCleanCallback = () => (Promise<void> | void);

export interface IBox<T extends MessageData, O extends MessageData> {
	// metadata: what I provide, what I require
	// needed to barely check the dependencies of the pipeline
	readonly meta: BoxMeta;
	// cleaning actions, e.g. disconnecting the DBs, cleaning internal cache, etc.
	readonly onClean: OnCleanCallback[];
	// the processing function itself
	process(value: T): Promise<O> | O
}
