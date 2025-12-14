/**
 * Mapper 3 - Passthrough mapper for benchmarking
 */
import {boxFactory, ServiceProvider, MessageData} from '../../../src';

module.exports = boxFactory(
	{
		provides: ['m3_processed'],
		requires: [],
		emits: [],
		aggregates: false,
	},
	function processValue(
		_serviceProvider: ServiceProvider,
		_value: MessageData
	): MessageData {
		return {m3_processed: true};
	}
);
