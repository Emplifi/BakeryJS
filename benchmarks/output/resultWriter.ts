/**
 * Result writing utilities for benchmark runner
 */

import * as path from 'path'
import * as fs from 'fs'
import { BenchmarkConfig, BenchmarkResult } from '../types'
import { ProgressState } from '../progress'
import { getGitCommitSha } from '../utils/git'

/** Directory for storing benchmark results */
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
 * Save benchmark results to a JSON file
 */
export function saveResults(results: BenchmarkResult[]): string {
	ensureResultsDir()

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
	const filename = path.join(RESULTS_DIR, `benchmark-${timestamp}.json`)

	fs.writeFileSync(filename, JSON.stringify(results, null, 2))
	console.log(`\nResults saved to: ${filename}`)

	return filename
}

/** Partial result structure for incomplete runs */
export interface PartialResult {
	status: 'incomplete'
	reason: string
	flowType: string
	config: BenchmarkConfig
	elapsedMs: number
	sentEventCount: number
	messagesProcessed: number
	expectedMessages: number
	avgTimePerMessageMs: number | null
	messagesPerSecond: number
	memoryMB: number
	peakMemoryMB: number
	timestamp: string
	nodeVersion: string
	gitCommitSha: string | undefined
	environment: {
		BAKERYJS_DISABLE_EXPERIMENTAL_TRACING?: string
	}
}

/**
 * Save partial results for incomplete benchmark runs
 */
export function savePartialResults(
	flowType: string,
	config: BenchmarkConfig,
	state: ProgressState,
	reason: string
): string {
	const elapsed = Date.now() - state.startTime
	const mem = process.memoryUsage()

	const partialResult: PartialResult = {
		status: 'incomplete',
		reason,
		flowType,
		config,
		elapsedMs: elapsed,
		sentEventCount: state.sentCount,
		messagesProcessed: state.drainedCount,
		expectedMessages: state.expectedMessages,
		avgTimePerMessageMs: state.drainedCount > 0 ? elapsed / state.drainedCount : null,
		messagesPerSecond: state.drainedCount > 0 ? state.drainedCount / (elapsed / 1000) : 0,
		memoryMB: mem.heapUsed / 1024 / 1024,
		peakMemoryMB: state.peakMemory / 1024 / 1024,
		timestamp: new Date().toISOString(),
		nodeVersion: process.version,
		gitCommitSha: getGitCommitSha(),
		environment: {
			BAKERYJS_DISABLE_EXPERIMENTAL_TRACING: process.env.BAKERYJS_DISABLE_EXPERIMENTAL_TRACING
		}
	}

	ensureResultsDir()

	const filename = `partial-${flowType}-${config.itemCount}x${
		config.nestedItemCount || 1
	}-${Date.now()}.json`
	const filepath = path.join(RESULTS_DIR, filename)
	fs.writeFileSync(filepath, JSON.stringify(partialResult, null, 2))
	console.log(`\nPartial results saved to: ${filepath}`)

	return filepath
}
