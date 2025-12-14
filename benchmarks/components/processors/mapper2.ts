/**
 * Mapper 2 - Passthrough mapper for benchmarking
 */
import { boxFactory, ServiceProvider, MessageData } from '../../../src'

module.exports = boxFactory(
	{
		provides: ['m2_processed'],
		requires: [],
		emits: [],
		aggregates: false
	},
	function processValue(_serviceProvider: ServiceProvider, _value: MessageData): MessageData {
		return { m2_processed: true }
	}
)
