import type { BatchingBoxInterface, BoxInterface } from './BoxI'
import type { PriorityQueueI } from './queue/PriorityQueueI'
import type { Message } from './Message'

export default interface ComponentFactoryI {
	create(
		name: string,
		queue?: PriorityQueueI<Message>,
		parameters?: any
	): Promise<BoxInterface | BatchingBoxInterface>
}
