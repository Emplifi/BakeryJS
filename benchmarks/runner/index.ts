/**
 * Core benchmark runner
 */

import * as path from 'path';
import {Program, MessageData} from '../../src';
import {BenchmarkConfig, BenchmarkResult, BenchmarkMetrics, EventTimelineEntry} from '../types';
import {createSimpleFlow} from '../flows/simpleFlow';
import {createComplexFlow} from '../flows/complexFlow';
import {getGitCommitSha} from '../utils/git';
import {createProgressState, startProgressLogging, ProgressState} from '../progress';
import {savePartialResults} from '../output';
import {calculateExpectedMessages} from '../config';
import {
	createMemoryTracker,
	stopMemoryTracker,
	getMemorySnapshot,
	forceGC,
} from './memoryTracker';
import {
	createSentEventState,
	subscribeToEvents,
	calculateEventTimings,
} from './eventHandlers';

/** Options for running a benchmark */
export interface RunBenchmarkOptions {
	flowType: 'simple' | 'complex';
	config: BenchmarkConfig;
	verbose: boolean;
	timeout?: number;
}

/**
 * Run a single benchmark
 */
export async function runBenchmark(options: RunBenchmarkOptions): Promise<BenchmarkResult> {
	const {flowType, config, verbose, timeout = 0} = options;

	// Setup program and flow
	const componentsPath = path.join(__dirname, '..', 'components');
	const program = new Program({}, {componentPaths: [componentsPath]});
	const flow =
		flowType === 'simple'
			? createSimpleFlow(config.itemCount)
			: createComplexFlow(config.itemCount, config.nestedItemCount || 10);

	// Initialize tracking state
	const expectedMessages = calculateExpectedMessages(flowType, config);
	const timeline: EventTimelineEntry[] = [];
	const drainedMessages: MessageData[] = [];
	const sentState = createSentEventState();
	let timedOut = false;

	// Start memory tracking
	const memoryTracker = createMemoryTracker();

	// Setup progress tracking
	const progressState: ProgressState = createProgressState(expectedMessages);
	const progressInterval = startProgressLogging(
		progressState,
		() => sentState.sentCount,
		() => drainedMessages.length,
		() => memoryTracker.peakMemory
	);

	// Subscribe to events
	subscribeToEvents(program, sentState, timeline, verbose);

	// Force GC before starting
	forceGC();
	const startMemory = getMemorySnapshot();
	const startTime = Date.now();
	progressState.startTime = startTime;

	// Setup timeout if specified
	let timeoutHandle: NodeJS.Timeout | null = null;
	const timeoutPromise =
		timeout > 0
			? new Promise<void>((_, reject) => {
					timeoutHandle = setTimeout(() => {
						timedOut = true;
						reject(new Error('Benchmark timeout'));
					}, timeout);
			  })
			: null;

	// Run the benchmark
	try {
		const runPromise = program.run(flow, (msg: MessageData) => {
			drainedMessages.push(msg);
		});

		if (timeoutPromise) {
			await Promise.race([runPromise, timeoutPromise]);
		} else {
			await runPromise;
		}
	} catch (err) {
		if (timedOut) {
			cleanup();
			handleTimeout(flowType, config, progressState, sentState, memoryTracker, timeout, expectedMessages);
		}
		throw err;
	}

	// Cleanup and calculate results
	if (timeoutHandle) clearTimeout(timeoutHandle);
	clearInterval(progressInterval);
	const endTime = Date.now();
	const endMemory = getMemorySnapshot();
	stopMemoryTracker(memoryTracker);

	const totalTimeMs = endTime - startTime;

	return buildResult(
		flowType,
		config,
		totalTimeMs,
		drainedMessages.length,
		startMemory,
		endMemory,
		memoryTracker.peakMemory,
		sentState,
		startTime,
		timeline,
		verbose
	);

	function cleanup(): void {
		clearInterval(progressInterval);
		stopMemoryTracker(memoryTracker);
		if (timeoutHandle) clearTimeout(timeoutHandle);
	}

	function handleTimeout(
		ft: string,
		cfg: BenchmarkConfig,
		ps: ProgressState,
		ss: typeof sentState,
		mt: typeof memoryTracker,
		to: number,
		expected: number
	): never {
		ps.sentCount = ss.sentCount;
		ps.drainedCount = drainedMessages.length;
		ps.peakMemory = mt.peakMemory;
		savePartialResults(ft, cfg, ps, 'timeout');
		throw new Error(
			`Benchmark timed out after ${to / 1000}s. ` +
				`Processed ${drainedMessages.length}/${expected} messages, ${ss.sentCount} sent events.`
		);
	}
}

/**
 * Build the benchmark result object
 */
function buildResult(
	flowType: 'simple' | 'complex',
	config: BenchmarkConfig,
	totalTimeMs: number,
	messagesProcessed: number,
	startMemory: ReturnType<typeof getMemorySnapshot>,
	endMemory: ReturnType<typeof getMemorySnapshot>,
	peakMemory: number,
	sentState: ReturnType<typeof createSentEventState>,
	startTime: number,
	timeline: EventTimelineEntry[],
	verbose: boolean
): BenchmarkResult {
	const metrics: BenchmarkMetrics = {
		totalTimeMs,
		messagesProcessed,
		avgTimePerMessageMs: messagesProcessed > 0 ? totalTimeMs / messagesProcessed : 0,
		memoryUsedMB: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024,
		peakMemoryMB: peakMemory / 1024 / 1024,
		heapStats: {
			heapUsed: endMemory.heapUsed,
			heapTotal: endMemory.heapTotal,
			external: endMemory.external,
		},
	};

	const eventTimings = calculateEventTimings(
		sentState,
		startTime,
		totalTimeMs,
		timeline,
		verbose
	);

	return {
		name: `${flowType}-${config.itemCount}${
			config.nestedItemCount ? `x${config.nestedItemCount}` : ''
		}`,
		flowType,
		config,
		metrics,
		eventTimings,
		timestamp: new Date().toISOString(),
		nodeVersion: process.version,
		gitCommitSha: getGitCommitSha(),
		environment: {
			BAKERYJS_DISABLE_EXPERIMENTAL_TRACING:
				process.env.BAKERYJS_DISABLE_EXPERIMENTAL_TRACING,
		},
	};
}

