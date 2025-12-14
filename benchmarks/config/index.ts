/**
 * Benchmark configuration building
 */

import {BenchmarkConfig} from '../types';
import {ParsedArgs} from '../cli';

/** A benchmark configuration with its flow type */
export interface BenchmarkConfigEntry {
	flowType: 'simple' | 'complex';
	config: BenchmarkConfig;
}

/**
 * Build benchmark configurations based on CLI arguments
 */
export function buildBenchmarkConfigs(args: ParsedArgs): BenchmarkConfigEntry[] {
	const configs: BenchmarkConfigEntry[] = [];

	// Check if user provided custom items/nested values
	const hasCustomConfig = args.items !== 100 || args.nestedItems !== 10;

	if (hasCustomConfig) {
		// Use only the custom configuration
		if (args.flowType === 'simple' || args.flowType === 'all') {
			configs.push({
				flowType: 'simple',
				config: {itemCount: args.items},
			});
		}
		if (args.flowType === 'complex' || args.flowType === 'all') {
			configs.push({
				flowType: 'complex',
				config: {itemCount: args.items, nestedItemCount: args.nestedItems},
			});
		}
	} else {
		// Use default benchmark suite
		if (args.flowType === 'all' || args.flowType === 'simple') {
			configs.push(
				{flowType: 'simple', config: {itemCount: 10}},
				{flowType: 'simple', config: {itemCount: 100}},
				{flowType: 'simple', config: {itemCount: 1000}}
			);
		}

		if (args.flowType === 'all' || args.flowType === 'complex') {
			configs.push(
				{flowType: 'complex', config: {itemCount: 10, nestedItemCount: 5}},
				{flowType: 'complex', config: {itemCount: 10, nestedItemCount: 10}},
				{flowType: 'complex', config: {itemCount: 50, nestedItemCount: 10}},
				{flowType: 'complex', config: {itemCount: 100, nestedItemCount: 10}}
			);
		}
	}

	return configs;
}

/**
 * Calculate expected message count for a benchmark configuration
 */
export function calculateExpectedMessages(
	flowType: 'simple' | 'complex',
	config: BenchmarkConfig
): number {
	return flowType === 'simple'
		? config.itemCount
		: config.itemCount * (config.nestedItemCount || 10);
}

