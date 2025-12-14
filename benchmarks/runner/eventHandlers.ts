/**
 * Event handling utilities for benchmark runner
 */

import { Program } from '../../src'
import { EventTimelineEntry } from '../types'

/** State for tracking sent events */
export interface SentEventState {
	firstSentTimestamp: number
	lastSentTimestamp: number
	sentCount: number
}

/**
 * Create initial sent event state
 */
export function createSentEventState(): SentEventState {
	return {
		firstSentTimestamp: -1,
		lastSentTimestamp: 0,
		sentCount: 0
	}
}

/**
 * Subscribe to program events for benchmarking
 * @param program - The BakeryJS Program instance
 * @param sentState - State object to track sent events
 * @param timeline - Optional timeline array for verbose mode
 * @param verbose - Whether to record detailed timeline
 */
export function subscribeToEvents(
	program: Program,
	sentState: SentEventState,
	timeline: EventTimelineEntry[],
	verbose: boolean
): void {
	program.on('sent', (timestamp: number, source: string, target: string, batchSize: number) => {
		if (sentState.firstSentTimestamp < 0) {
			sentState.firstSentTimestamp = timestamp
		}
		sentState.lastSentTimestamp = timestamp
		sentState.sentCount++

		if (verbose) {
			timeline.push({
				timestampMs: timestamp,
				event: 'sent',
				source,
				target,
				batchSize
			})
		}
	})

	program.on('run', () => {
		if (verbose) {
			timeline.push({ timestampMs: Date.now(), event: 'run' })
		}
	})
}

/**
 * Calculate event timings from state
 */
export function calculateEventTimings(
	sentState: SentEventState,
	startTime: number,
	totalTimeMs: number,
	timeline: EventTimelineEntry[],
	verbose: boolean
): {
	firstSentMs: number
	lastSentMs: number
	drainCompleteMs: number
	sentEventCount: number
	timeline?: EventTimelineEntry[]
} {
	const firstSentMs =
		sentState.firstSentTimestamp >= 0 ? sentState.firstSentTimestamp - startTime : 0
	const lastSentMs =
		sentState.lastSentTimestamp > 0 ? sentState.lastSentTimestamp - startTime : totalTimeMs

	return {
		firstSentMs,
		lastSentMs,
		drainCompleteMs: totalTimeMs,
		sentEventCount: sentState.sentCount,
		...(verbose ? { timeline } : {})
	}
}
