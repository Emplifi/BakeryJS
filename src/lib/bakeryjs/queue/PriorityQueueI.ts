export interface PriorityQueueI<T> {
	push(message: T | T[], priority?: number): Promise<void> | void;
	length: number;
	source?: string;
	target: string;
}
