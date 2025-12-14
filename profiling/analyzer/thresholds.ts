/**
 * Configurable Threshold Constants for Profile Analysis
 *
 * These thresholds control what is considered a hotspot, bottleneck, or regression.
 */

/** Default thresholds for analysis */
export interface AnalysisThresholds {
	/** Minimum self-time percentage to flag as a hotspot (default: 5%) */
	hotspotSelfTimePercent: number

	/** Minimum total-time percentage to flag as a bottleneck (default: 10%) */
	bottleneckTotalTimePercent: number

	/** Minimum percentage increase to flag as a regression (default: 10%) */
	regressionChangePercent: number

	/** Number of top functions to include in reports (default: 10) */
	topN: number

	/** Minimum hit count to consider a function significant */
	minHitCount: number
}

/** Default analysis thresholds */
export const DEFAULT_THRESHOLDS: AnalysisThresholds = {
	hotspotSelfTimePercent: 5.0,
	bottleneckTotalTimePercent: 10.0,
	regressionChangePercent: 10.0,
	topN: 10,
	minHitCount: 10
}

/**
 * Create thresholds from partial overrides
 */
export function createThresholds(overrides: Partial<AnalysisThresholds> = {}): AnalysisThresholds {
	return {
		...DEFAULT_THRESHOLDS,
		...overrides
	}
}

/**
 * Source file patterns for filtering by code category
 */
export const SOURCE_PATTERNS = {
	/** BakeryJS core source files */
	bakeryJs: ['/src/lib/bakeryjs/', '/src/'],

	/** TracingModel specifically */
	tracingModel: ['TracingModel.ts'],

	/** Flow-related code */
	flow: ['Flow.ts', 'FlowBuilder'],

	/** Box-related code */
	box: ['Box.ts', 'BoxFactory', 'Box/'],

	/** Benchmark-specific code (not core BakeryJS) */
	benchmark: ['/benchmarks/'],

	/** Node.js internal patterns */
	nodeInternals: ['node:', 'internal/', 'v8/', 'native '],

	/** Third-party libraries */
	nodeModules: ['node_modules/']
}

/**
 * Categorize a file path into a code category
 */
export function categorizeFile(url: string): string {
	if (!url) {
		return 'native'
	}

	// Check TracingModel first (most specific)
	if (SOURCE_PATTERNS.tracingModel.some(p => url.includes(p))) {
		return 'TracingModel'
	}

	// Check Flow
	if (SOURCE_PATTERNS.flow.some(p => url.includes(p))) {
		return 'Flow'
	}

	// Check Box
	if (SOURCE_PATTERNS.box.some(p => url.includes(p))) {
		return 'Box'
	}

	// Check other BakeryJS code
	if (SOURCE_PATTERNS.bakeryJs.some(p => url.includes(p))) {
		return 'Other BakeryJS'
	}

	// Check benchmark code
	if (SOURCE_PATTERNS.benchmark.some(p => url.includes(p))) {
		return 'Benchmark'
	}

	// Check node_modules
	if (SOURCE_PATTERNS.nodeModules.some(p => url.includes(p))) {
		return 'Dependencies'
	}

	// Check Node.js internals
	if (SOURCE_PATTERNS.nodeInternals.some(p => url.includes(p))) {
		return 'Node.js Internals'
	}

	return 'Other'
}

/**
 * Check if a file is part of BakeryJS core (not benchmarks or dependencies)
 */
export function isBakeryJsCore(url: string): boolean {
	if (!url) return false

	// Must be in src/ but not in benchmarks
	return (
		SOURCE_PATTERNS.bakeryJs.some(p => url.includes(p)) &&
		!SOURCE_PATTERNS.benchmark.some(p => url.includes(p))
	)
}
