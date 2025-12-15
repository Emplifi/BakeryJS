/**
 * Console Reporter
 *
 * Generates human-readable console output for profile analysis results.
 */

import { AnalysisResult, Hotspot, CategoryBreakdown, Regression } from '../types'

/** Box drawing characters for tables */
const BOX = {
	topLeft: '┌',
	topRight: '┐',
	bottomLeft: '└',
	bottomRight: '┘',
	horizontal: '─',
	vertical: '│',
	cross: '┼',
	topTee: '┬',
	bottomTee: '┴',
	leftTee: '├',
	rightTee: '┤'
}

/**
 * Format a number with thousands separators
 */
function formatNumber(n: number): string {
	return Math.round(n).toLocaleString('en-US')
}

/**
 * Pad a string to the left
 */
function padLeft(str: string, width: number): string {
	return str.padStart(width)
}

/**
 * Pad a string to the right
 */
function padRight(str: string, width: number): string {
	return str.padEnd(width)
}

/**
 * Truncate a string to a maximum length
 */
function truncate(str: string, maxLen: number): string {
	if (str.length <= maxLen) return str
	return str.slice(0, maxLen - 3) + '...'
}

/**
 * Print the report header
 */
function printHeader(result: AnalysisResult): void {
	const line = '═'.repeat(66)
	console.log(`╔${line}╗`)
	console.log(`║${padRight('                    FLAME GRAPH ANALYSIS REPORT', 66)}║`)
	console.log(`╠${line}╣`)
	console.log(`║ ${padRight(`Profile: ${result.profile.filename}`, 65)}║`)
	console.log(
		`║ ${padRight(`Duration: ${(result.profile.durationMs / 1000).toFixed(1)}s | Samples: ${formatNumber(result.profile.sampleCount)} | Sample Rate: ${result.profile.sampleRateHz}Hz`, 65)}║`
	)
	console.log(`╚${line}╝`)
	console.log()
}

/**
 * Print a table of hotspots
 */
function printHotspotsTable(
	hotspots: Hotspot[],
	title: string,
	sortByTotal: boolean = false
): void {
	console.log(`${title}`)

	const cols = { rank: 4, func: 33, selfPct: 10, selfMs: 9, location: 26 }

	// Header
	console.log(
		`${BOX.topLeft}${BOX.horizontal.repeat(cols.rank)}${BOX.topTee}` +
			`${BOX.horizontal.repeat(cols.func)}${BOX.topTee}` +
			`${BOX.horizontal.repeat(cols.selfPct)}${BOX.topTee}` +
			`${BOX.horizontal.repeat(cols.selfMs)}${BOX.topTee}` +
			`${BOX.horizontal.repeat(cols.location)}${BOX.topRight}`
	)

	const timeLabel = sortByTotal ? 'Total %' : 'Self %'
	const msLabel = sortByTotal ? 'Total ms' : 'Self ms'

	console.log(
		`${BOX.vertical}${padRight(' #', cols.rank)}${BOX.vertical}` +
			`${padRight(' Function', cols.func)}${BOX.vertical}` +
			`${padLeft(timeLabel + ' ', cols.selfPct)}${BOX.vertical}` +
			`${padLeft(msLabel + ' ', cols.selfMs)}${BOX.vertical}` +
			`${padRight(' Location', cols.location)}${BOX.vertical}`
	)

	console.log(
		`${BOX.leftTee}${BOX.horizontal.repeat(cols.rank)}${BOX.cross}` +
			`${BOX.horizontal.repeat(cols.func)}${BOX.cross}` +
			`${BOX.horizontal.repeat(cols.selfPct)}${BOX.cross}` +
			`${BOX.horizontal.repeat(cols.selfMs)}${BOX.cross}` +
			`${BOX.horizontal.repeat(cols.location)}${BOX.rightTee}`
	)

	// Rows
	hotspots.forEach((h, i) => {
		const pct = sortByTotal ? h.totalTimePercent : h.selfTimePercent
		const ms = sortByTotal ? h.totalTimeMs : h.selfTimeMs
		const location = `${truncate(h.file, 18)}:${h.line}`

		console.log(
			`${BOX.vertical}${padLeft(String(i + 1) + ' ', cols.rank)}${BOX.vertical}` +
				`${padRight(' ' + truncate(h.function, cols.func - 2), cols.func)}${BOX.vertical}` +
				`${padLeft(pct.toFixed(1) + '% ', cols.selfPct)}${BOX.vertical}` +
				`${padLeft(formatNumber(ms) + ' ', cols.selfMs)}${BOX.vertical}` +
				`${padRight(' ' + location, cols.location)}${BOX.vertical}`
		)
	})

	// Footer
	console.log(
		`${BOX.bottomLeft}${BOX.horizontal.repeat(cols.rank)}${BOX.bottomTee}` +
			`${BOX.horizontal.repeat(cols.func)}${BOX.bottomTee}` +
			`${BOX.horizontal.repeat(cols.selfPct)}${BOX.bottomTee}` +
			`${BOX.horizontal.repeat(cols.selfMs)}${BOX.bottomTee}` +
			`${BOX.horizontal.repeat(cols.location)}${BOX.bottomRight}`
	)
	console.log()
}

/**
 * Print code breakdown by category
 */
function printBreakdown(breakdown: Record<string, CategoryBreakdown>): void {
	console.log('📊 CODE BREAKDOWN BY CATEGORY')
	for (const [category, data] of Object.entries(breakdown)) {
		const bar = '█'.repeat(Math.min(Math.round(data.percent / 2), 40))
		console.log(
			`  ${padRight(category + ':', 20)} ${padLeft(data.percent.toFixed(1) + '%', 6)} (${formatNumber(data.timeMs)}ms) ${bar}`
		)
	}
	console.log()
}

/**
 * Print regressions
 */
function printRegressions(regressions: Regression[]): void {
	if (regressions.length === 0) {
		console.log('✅ No regressions detected compared to baseline.')
	} else {
		console.log('🚨 REGRESSIONS DETECTED')
		for (const r of regressions) {
			console.log(
				`  ${r.function}: ${r.previousPercent.toFixed(1)}% → ${r.currentPercent.toFixed(1)}% (+${r.changePercent.toFixed(1)}%)`
			)
		}
	}
	console.log()
}

/**
 * Generate and print a console report
 */
export function printConsoleReport(result: AnalysisResult): void {
	printHeader(result)

	if (result.hotspots.length > 0) {
		printHotspotsTable(result.hotspots, '🔥 TOP HOTSPOTS BY SELF-TIME', false)
	}

	if (result.bottlenecks.length > 0) {
		printHotspotsTable(result.bottlenecks, '⚠️  POTENTIAL BOTTLENECKS (Total Time)', true)
	}

	if (Object.keys(result.breakdown).length > 0) {
		printBreakdown(result.breakdown)
	}

	printRegressions(result.regressions)
}
