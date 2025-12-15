/**
 * Memory tracking utilities for benchmark runner
 *
 * IMPORTANT: Accurate peak memory tracking during heavy async processing is
 * challenging in Node.js. When the event loop is saturated with microtasks
 * (Promises), timer-based sampling (setInterval/setImmediate) gets starved
 * and never executes. Worker threads can't access the parent's heap memory.
 *
 * Current approach:
 * - Track start memory before processing begins
 * - Track end memory after processing completes
 * - Peak memory is approximated as the end memory (highest point before GC)
 *
 * For true peak tracking, BakeryJS would need to expose memory sampling hooks.
 */

/** Memory tracking state */
export interface MemoryTrackerState {
	peakMemory: number
	startMemory: number
}

/**
 * Create a memory tracker
 * Captures the initial heap state for baseline comparison
 * @returns Memory tracker state
 */
export function createMemoryTracker(): MemoryTrackerState {
	const mem = process.memoryUsage()
	return {
		peakMemory: mem.heapUsed,
		startMemory: mem.heapUsed
	}
}

/**
 * Update peak memory with current snapshot
 * Call this when you have an opportunity to sample (e.g., between processing phases)
 */
export function updatePeakMemory(state: MemoryTrackerState): void {
	const mem = process.memoryUsage()
	if (mem.heapUsed > state.peakMemory) {
		state.peakMemory = mem.heapUsed
	}
}

/**
 * Stop memory tracking and take final peak sample
 * The end of processing is typically when memory is highest
 */
export function stopMemoryTracker(state: MemoryTrackerState): void {
	updatePeakMemory(state)
}

/**
 * Get current memory snapshot
 */
export function getMemorySnapshot(): {
	heapUsed: number
	heapTotal: number
	external: number
	rss: number
} {
	const mem = process.memoryUsage()
	return {
		heapUsed: mem.heapUsed,
		heapTotal: mem.heapTotal,
		external: mem.external,
		rss: mem.rss
	}
}

/**
 * Force garbage collection if available
 */
export function forceGC(): void {
	if (global.gc) {
		global.gc()
	}
}
