import { boxFactory, ServiceProvider, MessageData } from 'bakeryjs'

/**
 * Shared state for capturing what the custom service received.
 * Allows test assertions on custom service usage.
 */
export const customServiceCalls: Array<{ method: string; args: unknown[] }> = []

/**
 * Clears the custom service calls. Call this in beforeEach() hooks.
 */
export function clearCustomServiceCalls(): void {
	customServiceCalls.length = 0
}

/**
 * A processor that uses a custom service named 'customService'.
 * Useful for testing arbitrary custom service injection.
 *
 * This processor calls `customService.process(value)` and captures
 * the result in the message.
 */
const CustomServiceProcessor = boxFactory(
	{
		provides: ['customServiceResult'],
		requires: [],
		emits: [],
		aggregates: false
	},
	function processValue(serviceProvider: ServiceProvider, value: MessageData): MessageData {
		const customService = serviceProvider.get('customService')
		const result = customService.process(value)
		customServiceCalls.push({ method: 'process', args: [value] })
		return { customServiceResult: result }
	}
)

export default CustomServiceProcessor
