/**
 * Analyzer Entry Point
 *
 * Orchestrates hotspot detection, call stack analysis, and regression detection.
 */

// Re-export modules
export {
	AnalysisThresholds,
	DEFAULT_THRESHOLDS,
	createThresholds,
	categorizeFile,
	isBakeryJsCore,
	SOURCE_PATTERNS
} from './thresholds'

export {
	HotspotDetectionOptions,
	detectHotspots,
	detectBottlenecks,
	getFunctionsAboveThreshold,
	calculateHotspotCoverage
} from './hotspotDetector'

export {
	CallStackEntry,
	HotCallStack,
	buildCallStack,
	findHotPaths,
	calculateBreakdown,
	findDeepestBakeryJsStack,
	summarizeComponents
} from './callStackAnalyzer'

import { AnalysisResult, Hotspot, Regression } from '../types'
import { ParseResult } from '../parser'
import { getGitCommitSha } from '../../benchmarks/utils/git'
import { AnalysisThresholds, createThresholds, isBakeryJsCore } from './thresholds'
import { detectHotspots, detectBottlenecks } from './hotspotDetector'
import { calculateBreakdown } from './callStackAnalyzer'

/** Options for profile analysis */
export interface AnalyzeOptions {
	/** Override default thresholds */
	thresholds?: Partial<AnalysisThresholds>
	/** Include Node.js internals in analysis */
	includeInternals?: boolean
	/** Baseline analysis result for regression detection */
	baseline?: AnalysisResult
}

/**
 * Analyze a parsed profile and generate a complete analysis result
 *
 * @param parseResult The parsed profile result
 * @param options Analysis options
 * @returns Complete analysis result
 */
export function analyzeProfile(
	parseResult: ParseResult,
	options: AnalyzeOptions = {}
): AnalysisResult {
	const thresholds = createThresholds(options.thresholds)

	// File filter - by default only include BakeryJS core code
	const fileFilter = options.includeInternals ? undefined : (file: string) => isBakeryJsCore(file)

	// Detect hotspots (high self-time)
	const hotspots = detectHotspots(parseResult.functionSummaries, {
		thresholds,
		fileFilter
	})

	// Detect bottlenecks (high total-time)
	const bottlenecks = detectBottlenecks(parseResult.functionSummaries, {
		thresholds,
		fileFilter
	})

	// Calculate breakdown by category
	const breakdown = calculateBreakdown(parseResult.functionSummaries)

	// Detect regressions if baseline provided
	const regressions = options.baseline
		? detectRegressions(hotspots, options.baseline, thresholds)
		: []

	// Determine if analysis passed (no critical hotspots or regressions)
	const passed = regressions.length === 0

	return {
		profile: parseResult.metadata,
		hotspots,
		bottlenecks,
		breakdown,
		regressions,
		passed,
		timestamp: new Date().toISOString(),
		gitCommitSha: getGitCommitSha()
	}
}

/**
 * Detect regressions by comparing current hotspots to baseline
 */
function detectRegressions(
	currentHotspots: Hotspot[],
	baseline: AnalysisResult,
	thresholds: AnalysisThresholds
): Regression[] {
	const regressions: Regression[] = []

	// Create a map of baseline hotspots by function name
	const baselineMap = new Map<string, Hotspot>()
	for (const hotspot of baseline.hotspots) {
		baselineMap.set(`${hotspot.function}:${hotspot.file}`, hotspot)
	}

	// Compare current hotspots to baseline
	for (const current of currentHotspots) {
		const key = `${current.function}:${current.file}`
		const baselineHotspot = baselineMap.get(key)

		if (baselineHotspot) {
			// Check for regression
			const changePercent = current.selfTimePercent - baselineHotspot.selfTimePercent
			const relativeChange =
				baselineHotspot.selfTimePercent > 0
					? (changePercent / baselineHotspot.selfTimePercent) * 100
					: 0

			if (relativeChange >= thresholds.regressionChangePercent) {
				regressions.push({
					function: current.function,
					file: current.file,
					previousPercent: baselineHotspot.selfTimePercent,
					currentPercent: current.selfTimePercent,
					changePercent: relativeChange
				})
			}
		}
	}

	// Sort by severity of regression
	regressions.sort((a, b) => b.changePercent - a.changePercent)

	return regressions
}

/**
 * Compare two analysis results and generate a summary
 */
export function compareAnalyses(
	current: AnalysisResult,
	baseline: AnalysisResult
): { improved: string[]; regressed: string[]; unchanged: string[] } {
	const improved: string[] = []
	const regressed: string[] = []
	const unchanged: string[] = []

	const baselineMap = new Map<string, Hotspot>()
	for (const h of baseline.hotspots) {
		baselineMap.set(`${h.function}:${h.file}`, h)
	}

	for (const current_h of current.hotspots) {
		const key = `${current_h.function}:${current_h.file}`
		const base = baselineMap.get(key)

		if (base) {
			const change = current_h.selfTimePercent - base.selfTimePercent
			if (change > 1) {
				regressed.push(
					`${current_h.function}: ${base.selfTimePercent.toFixed(1)}% → ${current_h.selfTimePercent.toFixed(1)}%`
				)
			} else if (change < -1) {
				improved.push(
					`${current_h.function}: ${base.selfTimePercent.toFixed(1)}% → ${current_h.selfTimePercent.toFixed(1)}%`
				)
			} else {
				unchanged.push(current_h.function)
			}
		}
	}

	return { improved, regressed, unchanged }
}
