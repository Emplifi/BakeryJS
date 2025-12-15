/**
 * Hotspot Detection
 *
 * Detects functions consuming significant CPU time based on self-time percentage.
 */

import { FunctionSummary, Hotspot } from '../types'
import { AnalysisThresholds } from './thresholds'

/** Options for hotspot detection */
export interface HotspotDetectionOptions {
	/** Analysis thresholds */
	thresholds: AnalysisThresholds
	/** Filter function to include only certain files */
	fileFilter?: (url: string) => boolean
}

/**
 * Detect hotspots from function summaries
 *
 * Hotspots are functions with high self-time, indicating they are doing
 * significant work themselves (not just calling other functions).
 *
 * @param summaries Map of function summaries from call tree analysis
 * @param options Detection options
 * @returns Array of hotspots sorted by self-time (descending)
 */
export function detectHotspots(
	summaries: Map<string, FunctionSummary>,
	options: HotspotDetectionOptions
): Hotspot[] {
	const { thresholds, fileFilter } = options

	const hotspots: Hotspot[] = []

	for (const summary of summaries.values()) {
		// Skip if below hit count threshold
		if (summary.hitCount < thresholds.minHitCount) {
			continue
		}

		// Skip if below self-time threshold
		if (summary.selfTimePercent < thresholds.hotspotSelfTimePercent) {
			continue
		}

		// Apply file filter if provided
		if (fileFilter && !fileFilter(summary.file)) {
			continue
		}

		hotspots.push(summaryToHotspot(summary))
	}

	// Sort by self-time descending
	hotspots.sort((a, b) => b.selfTimeMs - a.selfTimeMs)

	// Return top N
	return hotspots.slice(0, thresholds.topN)
}

/**
 * Detect bottlenecks from function summaries
 *
 * Bottlenecks are functions with high total-time, indicating they are
 * the entry points for expensive operations (including child calls).
 *
 * @param summaries Map of function summaries from call tree analysis
 * @param options Detection options
 * @returns Array of bottlenecks sorted by total-time (descending)
 */
export function detectBottlenecks(
	summaries: Map<string, FunctionSummary>,
	options: HotspotDetectionOptions
): Hotspot[] {
	const { thresholds, fileFilter } = options

	const bottlenecks: Hotspot[] = []

	for (const summary of summaries.values()) {
		// Skip if below hit count threshold
		if (summary.hitCount < thresholds.minHitCount) {
			continue
		}

		// Skip if below total-time threshold
		if (summary.totalTimePercent < thresholds.bottleneckTotalTimePercent) {
			continue
		}

		// Apply file filter if provided
		if (fileFilter && !fileFilter(summary.file)) {
			continue
		}

		bottlenecks.push(summaryToHotspot(summary))
	}

	// Sort by total-time descending
	bottlenecks.sort((a, b) => b.totalTimeMs - a.totalTimeMs)

	// Return top N
	return bottlenecks.slice(0, thresholds.topN)
}

/**
 * Convert a FunctionSummary to a Hotspot
 */
function summaryToHotspot(summary: FunctionSummary): Hotspot {
	return {
		function: summary.functionName,
		file: summary.file,
		line: summary.lineNumber,
		selfTimeMs: summary.selfTimeMs,
		selfTimePercent: summary.selfTimePercent,
		totalTimeMs: summary.totalTimeMs,
		totalTimePercent: summary.totalTimePercent,
		hitCount: summary.hitCount
	}
}

/**
 * Get all functions above a certain self-time threshold
 */
export function getFunctionsAboveThreshold(
	summaries: Map<string, FunctionSummary>,
	selfTimePercent: number
): FunctionSummary[] {
	return Array.from(summaries.values())
		.filter(s => s.selfTimePercent >= selfTimePercent)
		.sort((a, b) => b.selfTimeMs - a.selfTimeMs)
}

/**
 * Calculate the total time consumed by a set of hotspots
 */
export function calculateHotspotCoverage(
	hotspots: Hotspot[],
	totalProfileTimeMs: number
): { timeMs: number; percent: number } {
	const timeMs = hotspots.reduce((sum, h) => sum + h.selfTimeMs, 0)
	const percent = totalProfileTimeMs > 0 ? (timeMs / totalProfileTimeMs) * 100 : 0
	return { timeMs, percent }
}
