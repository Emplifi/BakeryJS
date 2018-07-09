import {BoxMeta, IBox, OnCleanCallback} from './IBox';
import {MessageData} from './Message';
import {IPriorityQueue} from './queue/IPriorityQueue';

export abstract class Box<T extends MessageData, O extends MessageData, C extends MessageData> implements IBox<T, O> {
    readonly name: string;
	// metadata: what I provide, what I require
	// needed to barely check the dependencies of the pipeline
	abstract readonly meta: BoxMeta;
	// cleaning actions, e.g. disconnecting the DBs, cleaning internal cache, etc.
	readonly onClean: OnCleanCallback[] = [];
    private readonly queue?: IPriorityQueue<C>;

    protected constructor(name: string, queue?: IPriorityQueue<C>) {
        this.name = name;
        this.queue = queue;
    }

	// the processing function itself
	public async process(value: T): Promise<O> {
        return await this.processValue(value, (chunk: C, priority: number): void => {
            if (this.queue == null) {
                throw new Error(`${this.name} has not defined a queue for generating values.`);
            }
            this.queue.push(chunk, {priority});
        });
    }

    protected abstract processValue(value: T, chunkCallback: (chunk: C, priority: number) => void): Promise<O> | O;
}
