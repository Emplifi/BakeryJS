/**
 * CLI argument parsing for profiling
 */

/** Parsed CLI arguments for profiling */
export interface ProfilingArgs {
	/** Profiling duration in seconds */
	duration: number
	/** Warmup period in seconds before profiling starts */
	warmup: number
	/** Flow type to run */
	flowType: 'simple' | 'complex'
	/** Number of items for first generator */
	items: number
	/** Number of nested items (complex flow only) */
	nested: number
	/** Whether to output JSON format */
	json: boolean
	/** Path to specific profile file to analyze */
	file?: string
	/** Path to baseline profile for comparison */
	baseline?: string
	/** Hotspot threshold percentage */
	hotspotThreshold: number
	/** Regression threshold percentage */
	regressionThreshold: number
	/** Number of top functions to report */
	topN: number
	/** Include Node.js internal functions */
	includeInternals: boolean
	/** Output file path for JSON results */
	output?: string
}

/** Default values for CLI arguments */
const DEFAULTS: ProfilingArgs = {
	duration: 30,
	warmup: 5,
	flowType: 'complex',
	items: 100,
	nested: 10,
	json: false,
	hotspotThreshold: 5,
	regressionThreshold: 10,
	topN: 10,
	includeInternals: false
}

/**
 * Parse command line arguments for profiling
 *
 * Supported arguments:
 *   --duration=<seconds>      Profiling duration (default: 30)
 *   --warmup=<seconds>        Warmup period before profiling (default: 5)
 *   --flow=simple|complex     Flow type to run (default: complex)
 *   --items=<number>          Number of items for first generator (default: 100)
 *   --nested=<number>         Number of nested items (default: 10)
 *   --json                    Output JSON format
 *   --file=<path>             Specific profile file to analyze
 *   --baseline=<path>         Baseline profile for comparison
 *   --hotspot-threshold=<n>   Minimum % self-time to flag as hotspot (default: 5)
 *   --regression-threshold=<n> Minimum % increase to flag regression (default: 10)
 *   --top-n=<number>          Number of top functions to report (default: 10)
 *   --include-internals       Include Node.js internal functions
 *   --output=<path>           Output file path for JSON results
 */
export function parseProfilingArgs(): ProfilingArgs {
	const args = process.argv.slice(2)
	const result: ProfilingArgs = { ...DEFAULTS }

	for (const arg of args) {
		if (arg.startsWith('--duration=')) {
			result.duration = parseInt(arg.split('=')[1] as string, 10)
		} else if (arg.startsWith('--warmup=')) {
			result.warmup = parseInt(arg.split('=')[1] as string, 10)
		} else if (arg.startsWith('--flow=')) {
			const value = arg.split('=')[1]
			if (value === 'simple' || value === 'complex') {
				result.flowType = value
			}
		} else if (arg.startsWith('--items=')) {
			result.items = parseInt(arg.split('=')[1] as string, 10)
		} else if (arg.startsWith('--nested=')) {
			result.nested = parseInt(arg.split('=')[1] as string, 10)
		} else if (arg === '--json') {
			result.json = true
		} else if (arg.startsWith('--file=')) {
			result.file = arg.split('=')[1]
		} else if (arg.startsWith('--baseline=')) {
			result.baseline = arg.split('=')[1]
		} else if (arg.startsWith('--hotspot-threshold=')) {
			result.hotspotThreshold = parseFloat(arg.split('=')[1] as string)
		} else if (arg.startsWith('--regression-threshold=')) {
			result.regressionThreshold = parseFloat(arg.split('=')[1] as string)
		} else if (arg.startsWith('--top-n=')) {
			result.topN = parseInt(arg.split('=')[1] as string, 10)
		} else if (arg === '--include-internals') {
			result.includeInternals = true
		} else if (arg.startsWith('--output=')) {
			result.output = arg.split('=')[1]
		}
	}

	return result
}

/**
 * Print profiling header information to console
 */
export function printProfilingHeader(args: ProfilingArgs): void {
	console.log('BakeryJS CPU Profile Collection')
	console.log('================================')
	console.log(`Flow Type: ${args.flowType}`)
	console.log(`Items: ${args.items}`)
	console.log(`Nested Items: ${args.nested}`)
	console.log(`Warmup: ${args.warmup}s`)
	console.log(`Duration: ${args.duration}s`)
	console.log()
}

/**
 * Print analysis header information to console
 */
export function printAnalysisHeader(args: ProfilingArgs): void {
	console.log('BakeryJS Profile Analysis')
	console.log('=========================')
	console.log(`Hotspot Threshold: ${args.hotspotThreshold}%`)
	console.log(`Top N Functions: ${args.topN}`)
	console.log(`Include Internals: ${args.includeInternals}`)
	if (args.baseline) {
		console.log(`Baseline: ${args.baseline}`)
	}
	console.log()
}
