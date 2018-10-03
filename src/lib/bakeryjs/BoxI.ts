import {Message} from './Message';

export type BoxMeta = {
	provides: string[];
	requires: string[];
	emits: string[];
	aggregates: boolean;
	concurrency?: number;
};

export type BatchingBoxMeta = {
	provides: string[];
	requires: string[];
	aggregates: boolean;
	concurrency?: number;
	batch: {
		maxSize: number;
		timeoutSeconds?: number;
	};
};

export type OnCleanCallback = () => Promise<void> | void;

export interface BoxInterface {
	// metadata: what I provide, what I require
	// needed to barely check the dependencies of the pipeline
	readonly meta: BoxMeta;
	// cleaning actions, e.g. disconnecting the DBs, cleaning internal cache, etc.
	readonly onClean: OnCleanCallback[];
	// the processing function itself
	process(message: Message): Promise<void>;
}

export interface BatchingBoxInterface {
	// metadata: what I provide, what I require
	// needed to barely check the dependencies of the pipeline
	readonly meta: BatchingBoxMeta;
	// cleaning actions, e.g. disconnecting the DBs, cleaning internal cache, etc.
	readonly onClean: OnCleanCallback[];
	// the processing function itself
	process(batch: Message[]): Promise<void>;
}
