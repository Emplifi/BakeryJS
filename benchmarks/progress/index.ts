/**
 * Progress tracking and logging for benchmark runner
 */

/** Progress logging interval in milliseconds */
export const PROGRESS_LOG_INTERVAL = 5000;

/** State for tracking benchmark progress */
export interface ProgressState {
	startTime: number;
	sentCount: number;
	drainedCount: number;
	lastLogTime: number;
	lastDrainedCount: number;
	lastSentCount: number;
	peakMemory: number;
	expectedMessages: number;
}

/**
 * Create initial progress state
 */
export function createProgressState(expectedMessages: number): ProgressState {
	const now = Date.now();
	return {
		startTime: now,
		sentCount: 0,
		drainedCount: 0,
		lastLogTime: now,
		lastDrainedCount: 0,
		lastSentCount: 0,
		peakMemory: 0,
		expectedMessages,
	};
}

/**
 * Log progress during long-running benchmarks
 */
export function logProgress(state: ProgressState): void {
	const now = Date.now();
	const elapsed = now - state.startTime;
	const intervalMs = now - state.lastLogTime;
	const elapsedSec = (elapsed / 1000).toFixed(1);
	const mem = process.memoryUsage();
	const memMB = (mem.heapUsed / 1024 / 1024).toFixed(1);

	// Calculate instantaneous rate (messages in last interval)
	const msgsDelta = state.drainedCount - state.lastDrainedCount;
	const sentDelta = state.sentCount - state.lastSentCount;
	const instantRate =
		intervalMs > 0 ? ((msgsDelta / intervalMs) * 1000).toFixed(1) : '0';

	const pct =
		state.expectedMessages > 0
			? ((state.drainedCount / state.expectedMessages) * 100).toFixed(1)
			: '?';

	console.log(
		`  [${elapsedSec}s] Progress: ${state.drainedCount}/${state.expectedMessages} msgs (${pct}%), ` +
			`+${msgsDelta} msgs, +${sentDelta} sent, ${instantRate} msgs/sec, ${memMB} MB heap`
	);

	// Update last values for next interval
	state.lastLogTime = now;
	state.lastDrainedCount = state.drainedCount;
	state.lastSentCount = state.sentCount;
}

/**
 * Create a progress logging interval
 * @returns The interval ID for cleanup
 */
export function startProgressLogging(
	state: ProgressState,
	getSentCount: () => number,
	getDrainedCount: () => number,
	getPeakMemory: () => number
): NodeJS.Timeout {
	return setInterval(() => {
		state.sentCount = getSentCount();
		state.drainedCount = getDrainedCount();
		state.peakMemory = getPeakMemory();
		logProgress(state);
	}, PROGRESS_LOG_INTERVAL);
}

