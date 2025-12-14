import { MessageData } from 'bakeryjs'

/**
 * A utility class for collecting messages from a drain callback.
 * Useful for asserting on the messages that exit a flow.
 */
export class MessageCollector {
	public messages: MessageData[] = []

	/**
	 * Drain callback function to pass to program.run()
	 */
	public drain = (msg: MessageData): void => {
		this.messages.push(msg)
	}

	/**
	 * Clears all collected messages
	 */
	public clear(): void {
		this.messages = []
	}

	/**
	 * Returns the number of collected messages
	 */
	public get count(): number {
		return this.messages.length
	}

	/**
	 * Returns the first collected message, or undefined if none
	 */
	public get first(): MessageData | undefined {
		return this.messages[0]
	}

	/**
	 * Returns the last collected message, or undefined if none
	 */
	public get last(): MessageData | undefined {
		return this.messages[this.messages.length - 1]
	}

	/**
	 * Checks if any collected message has the specified property with the given value
	 */
	public hasMessageWith(property: string, value: unknown): boolean {
		return this.messages.some(msg => msg[property] === value)
	}
}
