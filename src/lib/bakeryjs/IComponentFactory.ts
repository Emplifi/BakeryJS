import {IBox} from './IBox';
import {IPriorityQueue} from './queue/IPriorityQueue';
import {MessageData} from './Message';

export default interface IComponentFactory {
    create(name: string, queue?: IPriorityQueue<MessageData>): Promise<IBox<MessageData, MessageData>> | IBox<MessageData, MessageData>;
}
