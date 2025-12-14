/**
 * CLI argument parsing for benchmark runner
 */

/** Parsed command line arguments */
export interface ParsedArgs {
	flowType: 'simple' | 'complex' | 'all';
	items: number;
	nestedItems: number;
	verbose: boolean;
	runs: number;
	timeout: number;
}

/** Default values for CLI arguments */
const DEFAULTS = {
	flowType: 'all' as const,
	items: 100,
	nestedItems: 10,
	verbose: false,
	runs: 1,
	timeout: 0, // 0 = no timeout
};

/**
 * Parse command line arguments
 *
 * Supported arguments:
 *   --flow=simple|complex|all
 *   --items=<number>
 *   --nested=<number>
 *   --verbose
 *   --runs=<number>
 *   --timeout=<seconds>
 */
export function parseArgs(): ParsedArgs {
	const args = process.argv.slice(2);
	let flowType: 'simple' | 'complex' | 'all' = DEFAULTS.flowType;
	let items = DEFAULTS.items;
	let nestedItems = DEFAULTS.nestedItems;
	let verbose = DEFAULTS.verbose;
	let runs = DEFAULTS.runs;
	let timeout = DEFAULTS.timeout;

	for (const arg of args) {
		if (arg.startsWith('--flow=')) {
			const value = arg.split('=')[1];
			if (value === 'simple' || value === 'complex' || value === 'all') {
				flowType = value;
			}
		} else if (arg.startsWith('--items=')) {
			items = parseInt(arg.split('=')[1], 10);
		} else if (arg.startsWith('--nested=')) {
			nestedItems = parseInt(arg.split('=')[1], 10);
		} else if (arg === '--verbose') {
			verbose = true;
		} else if (arg.startsWith('--runs=')) {
			runs = parseInt(arg.split('=')[1], 10);
		} else if (arg.startsWith('--timeout=')) {
			timeout = parseInt(arg.split('=')[1], 10) * 1000; // Convert to ms
		}
	}

	return {flowType, items, nestedItems, verbose, runs, timeout};
}

/**
 * Print benchmark header information to console
 */
export function printBenchmarkHeader(args: ParsedArgs): void {
	console.log('BakeryJS Flow Benchmark');
	console.log('=======================');
	console.log(`Flow Type: ${args.flowType}`);
	console.log(`Items: ${args.items}`);
	console.log(`Nested Items: ${args.nestedItems}`);
	console.log(`Runs: ${args.runs}`);
	console.log(`Verbose: ${args.verbose}`);
	console.log(`Timeout: ${args.timeout > 0 ? `${args.timeout / 1000}s` : 'none'}`);
	console.log(
		`Tracing Disabled: ${process.env.BAKERYJS_DISABLE_EXPERIMENTAL_TRACING || 'no'}`
	);
}

