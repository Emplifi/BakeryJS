import {IBox} from './IBox';
import {MessageData} from './Message';

export default interface IComponentProvider {
    getComponent(name: string): Promise<IBox<MessageData, MessageData>> | IBox<MessageData, MessageData>;
}
