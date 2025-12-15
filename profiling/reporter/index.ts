/**
 * Reporter Entry Point
 *
 * Orchestrates report generation for profile analysis results.
 */

// Re-export reporters
export { printConsoleReport } from './consoleReporter'

export {
	generateJsonReport,
	printJsonReport,
	saveJsonReport,
	loadAnalysisResult,
	getResultsDir
} from './jsonReporter'

import { AnalysisResult } from '../types'
import { printConsoleReport } from './consoleReporter'
import { printJsonReport, saveJsonReport } from './jsonReporter'

/** Options for generating reports */
export interface ReportOptions {
	/** Output JSON format instead of console */
	json?: boolean
	/** Output file path for JSON (only if json is true) */
	outputPath?: string
	/** Suppress console output */
	silent?: boolean
}

/**
 * Generate a report from analysis results
 *
 * @param result The analysis result to report
 * @param options Report generation options
 * @returns Path to saved JSON file if json output was requested, undefined otherwise
 */
export function generateReport(
	result: AnalysisResult,
	options: ReportOptions = {}
): string | undefined {
	if (options.json) {
		if (options.silent) {
			// Just save to file
			return saveJsonReport(result, options.outputPath)
		} else if (options.outputPath) {
			// Print and save
			printJsonReport(result)
			return saveJsonReport(result, options.outputPath)
		} else {
			// Just print
			printJsonReport(result)
			return undefined
		}
	} else {
		if (!options.silent) {
			printConsoleReport(result)
		}
		return undefined
	}
}

/**
 * Print a summary of the analysis for CI output
 */
export function printCiSummary(result: AnalysisResult): void {
	if (result.passed) {
		console.log('✅ Profile analysis PASSED')
	} else {
		console.log('❌ Profile analysis FAILED')
	}

	console.log(`   Hotspots found: ${result.hotspots.length}`)
	console.log(`   Bottlenecks found: ${result.bottlenecks.length}`)
	console.log(`   Regressions found: ${result.regressions.length}`)
}

/**
 * Determine the exit code based on analysis result
 *
 * @param result The analysis result
 * @returns 0 if passed, 1 if failed
 */
export function getExitCode(result: AnalysisResult): number {
	return result.passed ? 0 : 1
}
