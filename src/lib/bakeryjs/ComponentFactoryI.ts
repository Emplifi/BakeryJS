import {BatchingBoxInterface, BoxInterface} from './BoxI';
import {PriorityQueueI} from './queue/PriorityQueueI';
import {Message} from './Message';

export default interface ComponentFactoryI {
	create(
		name: string,
		queue?: PriorityQueueI<Message>
	): Promise<BoxInterface | BatchingBoxInterface>;
}
