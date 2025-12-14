import { boxFactory, ServiceProvider, MessageData, Logger } from 'bakeryjs'

/**
 * A processor that uses the logger service.
 * Useful for testing custom logger injection.
 *
 * This processor logs the incoming message using the logger service
 * and provides a 'logged' field indicating logging was performed.
 */
const LoggerProcessor = boxFactory(
	{
		provides: ['logged'],
		requires: [],
		emits: [],
		aggregates: false
	},
	function processValue(serviceProvider: ServiceProvider, _value: MessageData): MessageData {
		const logger = serviceProvider.get<Logger>('logger')
		logger.log({ loggerProcessor: _value })
		return { logged: true }
	}
)

export default LoggerProcessor
