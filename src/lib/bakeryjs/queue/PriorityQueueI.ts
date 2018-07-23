export interface PriorityQueueI<T> {
	push(message: T, priority?: number): Promise<void> | void;
}
