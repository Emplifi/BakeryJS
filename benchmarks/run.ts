#!/usr/bin/env npx ts-node
/**
 * BakeryJS Flow Benchmark Runner
 *
 * Executes benchmark flows and collects performance statistics.
 *
 * Usage:
 *   npm run benchmark                    # Run all benchmarks
 *   npm run benchmark:simple             # Run simple flow benchmarks only
 *   npm run benchmark:complex            # Run complex flow benchmarks only
 *   npm run benchmark:verbose            # Run with detailed event timeline
 *
 *   # With custom options:
 *   npm run benchmark -- --items=1000
 *   npm run benchmark -- --flow=simple --items=500
 *   npm run benchmark -- --timeout=60
 *
 *   # Compare with tracing disabled:
 *   BAKERYJS_DISABLE_EXPERIMENTAL_TRACING=1 npm run benchmark
 */

import {BenchmarkResult} from './types';
import {parseArgs, printBenchmarkHeader, ParsedArgs} from './cli';
import {buildBenchmarkConfigs, BenchmarkConfigEntry} from './config';
import {runBenchmark} from './runner';
import {formatResult, printSummaryComparison, saveResults} from './output';

/**
 * Run all benchmarks for the given configurations
 */
async function runAllBenchmarks(
	configs: BenchmarkConfigEntry[],
	args: ParsedArgs
): Promise<BenchmarkResult[]> {
	const results: BenchmarkResult[] = [];

	for (const {flowType, config} of configs) {
		console.log(`\nRunning ${flowType} benchmark with config:`, config);

		for (let run = 0; run < args.runs; run++) {
			if (args.runs > 1) console.log(`  Run ${run + 1}/${args.runs}...`);

			try {
				const result = await runBenchmark({
					flowType,
					config,
					verbose: args.verbose,
					timeout: args.timeout,
				});
				results.push(result);
				console.log(formatResult(result));
			} catch (err) {
				console.error(`\nBenchmark error: ${(err as Error).message}`);
				// Continue with other benchmarks
			}
		}
	}

	return results;
}

/**
 * Main entry point for the benchmark runner
 */
async function main(): Promise<void> {
	// Parse command line arguments
	const args = parseArgs();

	// Print header information
	printBenchmarkHeader(args);

	// Build benchmark configurations
	const configs = buildBenchmarkConfigs(args);

	// Run all benchmarks
	const results = await runAllBenchmarks(configs, args);

	// Print summary comparison
	printSummaryComparison(results);

	// Save results to file
	saveResults(results);

	// Force exit since Program may have lingering event listeners
	process.exit(0);
}

main().catch((err) => {
	console.error('Benchmark failed:', err);
	process.exit(1);
});
