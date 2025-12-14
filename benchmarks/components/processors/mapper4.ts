/**
 * Mapper 4 - Passthrough mapper for benchmarking (in nested dimension)
 */
import {boxFactory, ServiceProvider, MessageData} from '../../../src';

module.exports = boxFactory(
	{
		provides: ['m4_processed'],
		requires: [],
		emits: [],
		aggregates: false,
	},
	function processValue(
		_serviceProvider: ServiceProvider,
		_value: MessageData
	): MessageData {
		return {m4_processed: true};
	}
);

