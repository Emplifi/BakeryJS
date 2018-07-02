import {IBox} from './IBox';
import {MessageData} from './Message';

export default interface IComponentFactory {
    create(name: string): Promise<IBox<MessageData, MessageData>> | IBox<MessageData, MessageData>;
}
