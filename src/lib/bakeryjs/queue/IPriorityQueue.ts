import {Message} from '../Message';

export type MessageMetadata = {
	jobId: string;
	priority: number;
};

export interface IPriorityQueue<T extends Message> {
	push(message: T, priority?: number): Promise<void> | void;
}
