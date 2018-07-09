import {IBox} from './IBox';
import {IPriorityQueue} from './queue/IPriorityQueue';
import {Message, MessageData} from './Message';

export default interface IComponentFactory {
    create(name: string, queue?: IPriorityQueue<Message>): Promise<IBox<MessageData, MessageData>> | IBox<MessageData, MessageData>;
}
