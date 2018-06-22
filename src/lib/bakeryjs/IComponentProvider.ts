import {Message} from './Message';
import {IBox} from './types/Box';

export default interface IComponentProvider {
    getComponent(name: string): Promise<IBox<Message, Message>> | IBox<Message, Message>;
}
