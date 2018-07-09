import {Message} from '../Message';

export type MessageMetadata = {
    jobId?: string,
    priority: number,
};

export interface IPriorityQueue<T extends Message> {
    push(message: T, metadata: MessageMetadata): Promise<void> | void
    pushingFinished(jobId: string): Promise<void> | void
    setJobFinishedCallback(jobId: string, callback: () => (Promise<void> | void)): Promise<void> | void
}
