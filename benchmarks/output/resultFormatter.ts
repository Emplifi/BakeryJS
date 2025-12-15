/**
 * Result formatting utilities for benchmark runner
 */

import { BenchmarkResult } from '../types'

/**
 * Format a benchmark result for console output
 */
export function formatResult(result: BenchmarkResult): string {
	const lines = [
		`\n${'='.repeat(60)}`,
		`Benchmark: ${result.name}`,
		`${'='.repeat(60)}`,
		`Flow Type: ${result.flowType}`,
		`Config: items=${result.config.itemCount}${
			result.config.nestedItemCount ? `, nested=${result.config.nestedItemCount}` : ''
		}`,
		``,
		`Performance Metrics:`,
		`  Total Time: ${result.metrics.totalTimeMs.toFixed(2)} ms`,
		`  Messages Processed: ${result.metrics.messagesProcessed}`,
		`  Avg Time/Message: ${result.metrics.avgTimePerMessageMs.toFixed(4)} ms`,
		`  Memory Used: ${result.metrics.memoryUsedMB.toFixed(2)} MB`,
		`  Peak Memory: ${result.metrics.peakMemoryMB.toFixed(2)} MB`,
		``,
		`Event Timings:`,
		`  First Sent: ${result.eventTimings.firstSentMs.toFixed(2)} ms`,
		`  Last Sent: ${result.eventTimings.lastSentMs.toFixed(2)} ms`,
		`  Drain Complete: ${result.eventTimings.drainCompleteMs.toFixed(2)} ms`,
		`  Total Sent Events: ${result.eventTimings.sentEventCount}`
	]
	return lines.join('\n')
}

/**
 * Print summary comparison table for multiple benchmark results
 */
export function printSummaryComparison(results: BenchmarkResult[]): void {
	if (results.length <= 1) {
		return
	}

	console.log('\n' + '='.repeat(60))
	console.log('SUMMARY COMPARISON')
	console.log('='.repeat(60))
	console.log('\n| Benchmark | Messages | Time (ms) | Avg/Msg (ms) | Memory (MB) |')
	console.log('|-----------|----------|-----------|--------------|-------------|')

	for (const r of results) {
		console.log(
			`| ${r.name.padEnd(9)} | ${String(r.metrics.messagesProcessed).padStart(
				8
			)} | ${r.metrics.totalTimeMs.toFixed(1).padStart(9)} | ${r.metrics.avgTimePerMessageMs
				.toFixed(4)
				.padStart(12)} | ${r.metrics.memoryUsedMB.toFixed(2).padStart(11)} |`
		)
	}
}
