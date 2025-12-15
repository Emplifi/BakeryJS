import type { BoxMeta, BatchingBoxMeta } from '../BoxI'
import type { Message, MessageData } from '../Message'
import type { PriorityQueueI } from '../queue/PriorityQueueI'
import type { ServiceProvider } from '../ServiceProvider'
import type {
	BoxExecutiveDefinition,
	BoxExecutiveBatchDefinition,
	BoxFactorySignature,
	BatchingBoxFactorySignature
} from './types'
import { Box } from './Box'
import { BatchingBox } from './BatchingBox'

/**
 * Creates a single-message processing box factory.
 *
 * @param metadata - Information about intended operation of the code
 * @param processValueDef - The code of your box
 * @returns A box model class
 * @internalapi
 */
function boxSingleFactory(
	metadata: BoxMeta,
	processValueDef: BoxExecutiveDefinition
): BoxFactorySignature {
	return class extends Box {
		public constructor(
			providedName: string,
			serviceProvider: ServiceProvider,
			q?: PriorityQueueI<Message>,
			parameters?: any
		) {
			super(providedName, metadata, serviceProvider, q, parameters)
		}
		protected processValue(
			msg: MessageData,
			emit: (msgs: MessageData[], priority?: number) => void
		): ReturnType<BoxExecutiveDefinition> {
			return processValueDef(this.serviceParamsProvider, msg, emit)
		}
	}
}

/**
 * Creates a batch-processing box factory.
 *
 * @param metadata - Information about intended operation of the code
 * @param processValueDef - The code of your box
 * @returns A batching box model class
 * @internalapi
 */
function boxBatchingFactory(
	metadata: BatchingBoxMeta,
	processValueDef: BoxExecutiveBatchDefinition
): BatchingBoxFactorySignature {
	return class extends BatchingBox {
		public constructor(
			providedName: string,
			serviceProvider: ServiceProvider,
			q?: PriorityQueueI<Message>,
			parameters?: any
		) {
			super(providedName, metadata, serviceProvider, q, parameters)
		}
		protected processValue(msgs: MessageData[]): ReturnType<BoxExecutiveBatchDefinition> {
			return processValueDef(this.serviceParamsProvider, msgs)
		}
	}
}

/**
 * A basic mean of creating your own boxes.
 *
 * Each box has to be in its own file, the filename being the box's identificator (name).
 * The file is a JS (TS) module that `exports default` the return value of `boxFactory`.
 *
 * @param metadata - Information about intended operation of the code
 * @param processValueDef - The code of your box
 * @returns A box model. It must be the *default export* of the module.
 * @publicapi
 */
export function boxFactory(
	metadata: BoxMeta | BatchingBoxMeta,
	processValueDef: BoxExecutiveDefinition | BoxExecutiveBatchDefinition
): BoxFactorySignature | BatchingBoxFactorySignature {
	if ((metadata as BatchingBoxMeta).batch) {
		return boxBatchingFactory(
			metadata as BatchingBoxMeta,
			processValueDef as BoxExecutiveBatchDefinition
		)
	} else {
		return boxSingleFactory(metadata as BoxMeta, processValueDef as BoxExecutiveDefinition)
	}
}
