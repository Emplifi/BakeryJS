/**
 * Memory tracking utilities for benchmark runner
 */

/** Memory tracking state */
export interface MemoryTrackerState {
	peakMemory: number;
	intervalId: NodeJS.Timeout | null;
}

/**
 * Create a memory tracker that monitors peak memory usage
 * @param intervalMs - How often to check memory (default: 10ms)
 * @returns Memory tracker state with cleanup function
 */
export function createMemoryTracker(intervalMs: number = 10): MemoryTrackerState {
	const state: MemoryTrackerState = {
		peakMemory: 0,
		intervalId: null,
	};

	state.intervalId = setInterval(() => {
		const mem = process.memoryUsage();
		if (mem.heapUsed > state.peakMemory) {
			state.peakMemory = mem.heapUsed;
		}
	}, intervalMs);

	return state;
}

/**
 * Stop memory tracking and clean up
 */
export function stopMemoryTracker(state: MemoryTrackerState): void {
	if (state.intervalId) {
		clearInterval(state.intervalId);
		state.intervalId = null;
	}
}

/**
 * Get current memory snapshot
 */
export function getMemorySnapshot(): {
	heapUsed: number;
	heapTotal: number;
	external: number;
	rss: number;
} {
	const mem = process.memoryUsage();
	return {
		heapUsed: mem.heapUsed,
		heapTotal: mem.heapTotal,
		external: mem.external,
		rss: mem.rss,
	};
}

/**
 * Force garbage collection if available
 */
export function forceGC(): void {
	if (global.gc) {
		global.gc();
	}
}

