import {Message} from '../Message';

export interface PriorityQueueI<T extends Message> {
	push(message: T, priority?: number): Promise<void> | void;
}
