import type { Message, MessageData } from '../Message'

/**
 * Context provided to processing strategies containing all dependencies
 * needed to process messages.
 */
export interface BoxProcessingContext {
	/** Box name for error reporting */
	readonly name: string
	/** Metadata for the box */
	readonly meta: {
		requires: string[]
		provides: string[]
		emits?: string[]
	}
	/** Process the value using the box's business logic */
	readonly processValue: (
		msg: MessageData,
		emit: (batch: MessageData[], priority?: number) => void
	) => Promise<MessageData> | MessageData | Promise<any>
	/** The output queue to push processed messages */
	readonly queue: {
		push: (msgs: Message | Message[], priority?: number) => void
	}
	/** Emit events for tracing */
	readonly emit: (event: string, data: any) => void
}

/**
 * Strategy interface for processing messages.
 * Implementations handle the specific logic for each processing mode.
 */
export interface ProcessingStrategy {
	/**
	 * Execute the processing strategy on a message.
	 * @param msg - The message to process
	 * @param context - The box context providing dependencies
	 * @returns Promise resolving when processing is complete
	 */
	execute(msg: Message, context: BoxProcessingContext): Promise<any>
}
