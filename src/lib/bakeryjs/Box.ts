import {BoxMeta, IBox, OnCleanCallback} from './IBox';
import {Message, MessageData} from './Message';
import {IPriorityQueue} from './queue/IPriorityQueue';

export abstract class Box<T extends MessageData, O extends MessageData, C extends MessageData> implements IBox<T, O> {
    readonly name: string;
	readonly meta: BoxMeta;
	readonly onClean: OnCleanCallback[] = [];
    private readonly queue?: IPriorityQueue<Message>;

    protected constructor(name: string, meta: BoxMeta, queue?: IPriorityQueue<Message>) {
        this.name = name;
        this.meta = meta;
        this.queue = queue;
    }

	// the processing function itself
	public async process(value: T): Promise<O> {
        if (this.queue != null) {
            this.queue.setJobFinishedCallback(value.jobId, () => {});
            this.queue.setJobMessageFailedCallback(value.jobId, () => {});
        }
        const result = await this.processValue(value, (chunk: C, priority: number): void => {
            if (this.queue == null) {
                throw new Error(`${this.name} has not defined a queue for generating values.`);
            }
            const messageData: MessageData = {};
            for (const emitKey of this.meta.emits) {
                messageData[emitKey] = chunk[emitKey];
            }
            messageData.jobId = value.jobId;
            this.queue.push(new Message(messageData), {
                priority: priority,
                jobId: value.jobId,
            });
        });
        if (this.queue != null) {
            this.queue.pushingFinished(value.jobId);
        }

        return result;
    }

    protected abstract processValue(value: T, emitCallback: (chunk: C, priority: number) => void): Promise<O> | O;
}
