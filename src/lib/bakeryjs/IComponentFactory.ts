import {AsyncPriorityQueue} from 'async';
import {IBox} from './IBox';
import {MessageData} from './Message';

export default interface IComponentFactory {
    create(name: string, queue?: AsyncPriorityQueue<MessageData>): Promise<IBox<MessageData, MessageData>> | IBox<MessageData, MessageData>;
}
