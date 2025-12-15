/**
 * Mapper 1 - Passthrough mapper for benchmarking
 */
import { boxFactory, ServiceProvider, MessageData } from '../../../src'

module.exports = boxFactory(
	{
		provides: ['m1_processed'],
		requires: [],
		emits: [],
		aggregates: false
	},
	function processValue(_serviceProvider: ServiceProvider, _value: MessageData): MessageData {
		return { m1_processed: true }
	}
)
