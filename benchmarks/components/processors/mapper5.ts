/**
 * Mapper 5 - Passthrough mapper for benchmarking (in nested dimension)
 */
import { boxFactory, ServiceProvider, MessageData } from '../../../src'

module.exports = boxFactory(
	{
		provides: ['m5_processed'],
		requires: [],
		emits: [],
		aggregates: false
	},
	function processValue(_serviceProvider: ServiceProvider, _value: MessageData): MessageData {
		return { m5_processed: true }
	}
)
