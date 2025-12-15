/**
 * JSON Reporter
 *
 * Generates machine-readable JSON output for profile analysis results.
 */

import * as fs from 'fs'
import * as path from 'path'
import { AnalysisResult } from '../types'

/** Directory for storing analysis results */
const RESULTS_DIR = path.join(__dirname, '..', 'results')

/**
 * Ensure the results directory exists
 */
function ensureResultsDir(): void {
	if (!fs.existsSync(RESULTS_DIR)) {
		fs.mkdirSync(RESULTS_DIR, { recursive: true })
	}
}

/**
 * Convert AnalysisResult to JSON-friendly format
 *
 * This ensures consistent output format matching the schema in the implementation plan.
 */
function toJsonFormat(result: AnalysisResult): object {
	return {
		profile: {
			filename: result.profile.filename,
			duration_ms: result.profile.durationMs,
			sample_count: result.profile.sampleCount,
			sample_rate_hz: result.profile.sampleRateHz
		},
		hotspots: result.hotspots.map(h => ({
			function: h.function,
			file: h.file,
			line: h.line,
			self_time_ms: h.selfTimeMs,
			self_time_percent: h.selfTimePercent,
			total_time_ms: h.totalTimeMs,
			total_time_percent: h.totalTimePercent,
			hit_count: h.hitCount
		})),
		bottlenecks: result.bottlenecks.map(b => ({
			function: b.function,
			file: b.file,
			line: b.line,
			self_time_ms: b.selfTimeMs,
			self_time_percent: b.selfTimePercent,
			total_time_ms: b.totalTimeMs,
			total_time_percent: b.totalTimePercent,
			hit_count: b.hitCount
		})),
		breakdown: Object.fromEntries(
			Object.entries(result.breakdown).map(([category, data]) => [
				category,
				{ time_ms: data.timeMs, percent: data.percent }
			])
		),
		regressions: result.regressions.map(r => ({
			function: r.function,
			file: r.file,
			previous_percent: r.previousPercent,
			current_percent: r.currentPercent,
			change_percent: r.changePercent
		})),
		passed: result.passed,
		timestamp: result.timestamp,
		git_commit_sha: result.gitCommitSha
	}
}

/**
 * Generate JSON output as a string
 */
export function generateJsonReport(result: AnalysisResult): string {
	return JSON.stringify(toJsonFormat(result), null, 2)
}

/**
 * Print JSON report to console
 */
export function printJsonReport(result: AnalysisResult): void {
	console.log(generateJsonReport(result))
}

/**
 * Save JSON report to a file
 *
 * @param result The analysis result to save
 * @param outputPath Optional output path. If not provided, generates a timestamped filename.
 * @returns The path where the file was saved
 */
export function saveJsonReport(result: AnalysisResult, outputPath?: string): string {
	ensureResultsDir()

	const filepath =
		outputPath ||
		path.join(RESULTS_DIR, `analysis-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)

	// Ensure parent directory exists
	const dir = path.dirname(filepath)
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true })
	}

	fs.writeFileSync(filepath, generateJsonReport(result))
	return filepath
}

/**
 * Load a previously saved analysis result from JSON
 */
export function loadAnalysisResult(filepath: string): AnalysisResult | null {
	try {
		const content = fs.readFileSync(filepath, 'utf8')
		const data = JSON.parse(content)

		// Convert from JSON format back to AnalysisResult
		return {
			profile: {
				filename: data.profile.filename,
				durationMs: data.profile.duration_ms,
				sampleCount: data.profile.sample_count,
				sampleRateHz: data.profile.sample_rate_hz
			},
			hotspots: data.hotspots.map((h: Record<string, unknown>) => ({
				function: h.function,
				file: h.file,
				line: h.line,
				selfTimeMs: h.self_time_ms,
				selfTimePercent: h.self_time_percent,
				totalTimeMs: h.total_time_ms,
				totalTimePercent: h.total_time_percent,
				hitCount: h.hit_count
			})),
			bottlenecks: data.bottlenecks.map((b: Record<string, unknown>) => ({
				function: b.function,
				file: b.file,
				line: b.line,
				selfTimeMs: b.self_time_ms,
				selfTimePercent: b.self_time_percent,
				totalTimeMs: b.total_time_ms,
				totalTimePercent: b.total_time_percent,
				hitCount: b.hit_count
			})),
			breakdown: Object.fromEntries(
				Object.entries(data.breakdown).map(([category, d]: [string, unknown]) => {
					const breakdownData = d as { time_ms: number; percent: number }
					return [category, { timeMs: breakdownData.time_ms, percent: breakdownData.percent }]
				})
			),
			regressions: data.regressions.map((r: Record<string, unknown>) => ({
				function: r.function,
				file: r.file,
				previousPercent: r.previous_percent,
				currentPercent: r.current_percent,
				changePercent: r.change_percent
			})),
			passed: data.passed,
			timestamp: data.timestamp,
			gitCommitSha: data.git_commit_sha
		}
	} catch {
		return null
	}
}

/**
 * Get the results directory path
 */
export function getResultsDir(): string {
	return RESULTS_DIR
}
