/**
 * Types for the BakeryJS benchmarking system
 */

export interface BenchmarkConfig {
	/** Number of items for the first generator */
	itemCount: number;
	/** Number of items for nested generator (complex flow only) */
	nestedItemCount?: number;
	/** Artificial delay in ms for mapper boxes (0 = no delay) */
	mapperDelayMs?: number;
	/** Number of benchmark runs to average */
	runs?: number;
	/** Whether to output verbose logs */
	verbose?: boolean;
}

export interface BenchmarkMetrics {
	/** Total execution time in milliseconds */
	totalTimeMs: number;
	/** Total messages processed through the drain */
	messagesProcessed: number;
	/** Average time per message in milliseconds */
	avgTimePerMessageMs: number;
	/** Memory used at end of run in MB */
	memoryUsedMB: number;
	/** Peak memory during run in MB */
	peakMemoryMB: number;
	/** Heap statistics */
	heapStats?: {
		heapUsed: number;
		heapTotal: number;
		external: number;
	};
}

export interface EventTimings {
	/** Time of first 'sent' event from run start */
	firstSentMs: number;
	/** Time of last 'sent' event from run start */
	lastSentMs: number;
	/** Time when drain completed from run start */
	drainCompleteMs: number;
	/** Total number of 'sent' events */
	sentEventCount: number;
	/** Event timeline for detailed analysis */
	timeline?: EventTimelineEntry[];
}

export interface EventTimelineEntry {
	/** Timestamp relative to run start */
	timestampMs: number;
	/** Event type */
	event: 'sent' | 'run' | 'drain';
	/** Source box */
	source?: string;
	/** Target box */
	target?: string;
	/** Batch size */
	batchSize?: number;
}

export interface BenchmarkResult {
	/** Name of the benchmark */
	name: string;
	/** Type of flow */
	flowType: 'simple' | 'complex';
	/** Configuration used */
	config: BenchmarkConfig;
	/** Performance metrics */
	metrics: BenchmarkMetrics;
	/** Event timing information */
	eventTimings: EventTimings;
	/** Timestamp when benchmark was run */
	timestamp: string;
	/** Node.js version */
	nodeVersion: string;
	/** Git commit SHA of the repository */
	gitCommitSha?: string;
	/** Environment flags */
	environment: {
		BAKERYJS_DISABLE_EXPERIMENTAL_TRACING?: string;
	};
}

export interface BenchmarkSummary {
	/** Results for each configuration */
	results: BenchmarkResult[];
	/** Comparison analysis */
	analysis?: {
		/** Scaling factor (time increase per 10x messages) */
		scalingFactor: number;
		/** Whether scaling appears linear */
		isLinearScaling: boolean;
		/** Simple vs complex flow overhead ratio */
		complexityOverheadRatio: number;
	};
}

/**
 * Message data types for benchmark boxes
 */
export interface BenchmarkGeneratorInput {
	itemCount?: number;
	nestedItemCount?: number;
}

export interface BenchmarkGeneratorOutput {
	item: number;
	generatorId: string;
	timestamp: number;
}

export interface NestedGeneratorOutput {
	item: number;
	parentItem: number;
	generatorId: string;
	timestamp: number;
}

export interface MapperOutput {
	processed: boolean;
	processorId: string;
	processedAt: number;
}

