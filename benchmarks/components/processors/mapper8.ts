/**
 * Mapper 8 - Passthrough mapper for parallel stage benchmarking
 */
import {boxFactory, ServiceProvider, MessageData} from '../../../src';

module.exports = boxFactory(
	{
		provides: ['m8_processed'],
		requires: [],
		emits: [],
		aggregates: false,
	},
	function processValue(
		_serviceProvider: ServiceProvider,
		_value: MessageData
	): MessageData {
		return {m8_processed: true};
	}
);

