import {IBox} from './IBox';
import {IPriorityQueue} from './queue/IPriorityQueue';
import {Message} from './Message';

export default interface IComponentFactory {
	create(
		name: string,
		queue?: IPriorityQueue<Message>
	): Promise<IBox> | IBox;
}
