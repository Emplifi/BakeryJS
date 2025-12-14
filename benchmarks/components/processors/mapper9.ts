/**
 * Mapper 9 - Final passthrough mapper for benchmarking
 */
import {boxFactory, ServiceProvider, MessageData} from '../../../src';

module.exports = boxFactory(
	{
		provides: ['m9_processed'],
		requires: [],
		emits: [],
		aggregates: false,
	},
	function processValue(
		_serviceProvider: ServiceProvider,
		_value: MessageData
	): MessageData {
		return {m9_processed: true};
	}
);

