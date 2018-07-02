import {IBox} from './IBox';
import {Message} from './Message';

export default interface IComponentProvider {
    getComponent(name: string): Promise<IBox<Message, Message>> | IBox<Message, Message>;
}
