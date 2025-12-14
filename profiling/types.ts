/**
 * TypeScript type definitions for CPU profiling and flame graph analysis
 */

// ============================================================================
// V8 CPU Profile Types (as output by --cpu-prof)
// ============================================================================

/** V8 CPU profile call frame information */
export interface CpuProfileCallFrame {
	/** Name of the function */
	functionName: string
	/** V8 script ID */
	scriptId: string
	/** Full URL/path to the source file */
	url: string
	/** Line number (0-based) */
	lineNumber: number
	/** Column number (0-based) */
	columnNumber: number
}

/** A node in the V8 CPU profile call tree */
export interface CpuProfileNode {
	/** Unique node ID */
	id: number
	/** Call frame information */
	callFrame: CpuProfileCallFrame
	/** Number of times this node was sampled */
	hitCount: number
	/** IDs of child nodes */
	children?: number[]
	/** Position ticks (optional) */
	positionTicks?: Array<{ line: number; ticks: number }>
}

/** V8 CPU profile structure (as output by --cpu-prof) */
export interface CpuProfile {
	/** Array of all nodes in the profile */
	nodes: CpuProfileNode[]
	/** Profile start time in microseconds */
	startTime: number
	/** Profile end time in microseconds */
	endTime: number
	/** Array of node IDs sampled at each interval */
	samples?: number[]
	/** Time deltas between samples in microseconds */
	timeDeltas?: number[]
}

// ============================================================================
// Call Tree Types (Processed Profile Data)
// ============================================================================

/** Processed call tree node with calculated timing information */
export interface CallTreeNode {
	/** Node ID from the original profile */
	id: number
	/** Function name */
	functionName: string
	/** Source file URL */
	url: string
	/** Line number (1-based for display) */
	lineNumber: number
	/** Column number (1-based for display) */
	columnNumber: number
	/** Time spent in this function only (excluding children) in ms */
	selfTimeMs: number
	/** Time spent in this function including children in ms */
	totalTimeMs: number
	/** Hit count from sampling */
	hitCount: number
	/** Percentage of total time spent in self */
	selfTimePercent: number
	/** Percentage of total time including children */
	totalTimePercent: number
	/** Child nodes */
	children: CallTreeNode[]
	/** Parent node (undefined for root) */
	parent?: CallTreeNode
}

/** Flattened function data aggregated across all call sites */
export interface FunctionSummary {
	/** Function name */
	functionName: string
	/** Source file path (relative or extracted from URL) */
	file: string
	/** Primary line number */
	lineNumber: number
	/** Aggregated self time in ms */
	selfTimeMs: number
	/** Aggregated total time in ms */
	totalTimeMs: number
	/** Self time as percentage of total profile time */
	selfTimePercent: number
	/** Total time as percentage of total profile time */
	totalTimePercent: number
	/** Total hit count */
	hitCount: number
}

// ============================================================================
// Analysis Result Types
// ============================================================================

/** Profile metadata */
export interface ProfileMetadata {
	/** Profile filename */
	filename: string
	/** Profile duration in milliseconds */
	durationMs: number
	/** Total number of samples */
	sampleCount: number
	/** Sampling rate in Hz */
	sampleRateHz: number
}

/** Detected hotspot (function consuming significant CPU time) */
export interface Hotspot {
	/** Function name */
	function: string
	/** Source file path */
	file: string
	/** Line number */
	line: number
	/** Self time in milliseconds */
	selfTimeMs: number
	/** Self time percentage */
	selfTimePercent: number
	/** Total time in milliseconds */
	totalTimeMs: number
	/** Total time percentage */
	totalTimePercent: number
	/** Hit count */
	hitCount: number
}

/** Code category breakdown */
export interface CategoryBreakdown {
	/** Time spent in this category in ms */
	timeMs: number
	/** Percentage of total time */
	percent: number
}

/** Regression detection result */
export interface Regression {
	/** Function name */
	function: string
	/** File path */
	file: string
	/** Previous self time percentage */
	previousPercent: number
	/** Current self time percentage */
	currentPercent: number
	/** Percentage change */
	changePercent: number
}

/** Complete analysis result */
export interface AnalysisResult {
	/** Profile metadata */
	profile: ProfileMetadata
	/** Detected hotspots sorted by self-time */
	hotspots: Hotspot[]
	/** Potential bottlenecks sorted by total-time */
	bottlenecks: Hotspot[]
	/** Code breakdown by category */
	breakdown: Record<string, CategoryBreakdown>
	/** Detected regressions (if baseline provided) */
	regressions: Regression[]
	/** Whether analysis passed thresholds */
	passed: boolean
	/** Analysis timestamp */
	timestamp: string
	/** Git commit SHA */
	gitCommitSha?: string
}
