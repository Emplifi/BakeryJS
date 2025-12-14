/**
 * Call Stack Analysis
 *
 * Analyzes hot call stacks and frequently executed paths.
 */

import { CallTreeNode, FunctionSummary, CategoryBreakdown } from '../types'
import { categorizeFile } from './thresholds'

/** A call stack entry */
export interface CallStackEntry {
	/** Function name */
	functionName: string
	/** Source file */
	file: string
	/** Line number */
	line: number
}

/** A hot call stack with frequency information */
export interface HotCallStack {
	/** The call stack (from caller to callee) */
	stack: CallStackEntry[]
	/** Number of times this stack was sampled */
	hitCount: number
	/** Percentage of total samples */
	percent: number
}

/**
 * Build a call stack from a leaf node up to the root
 */
export function buildCallStack(node: CallTreeNode): CallStackEntry[] {
	const stack: CallStackEntry[] = []
	let current: CallTreeNode | undefined = node

	while (current) {
		stack.unshift({
			functionName: current.functionName,
			file: current.url,
			line: current.lineNumber
		})
		current = current.parent
	}

	return stack
}

/**
 * Find the hottest call paths in the tree
 *
 * A hot call path is a path from root to a high-hitcount leaf.
 */
export function findHotPaths(
	root: CallTreeNode,
	topN: number = 10
): Array<{ path: CallStackEntry[]; selfTimeMs: number; selfTimePercent: number }> {
	const paths: Array<{ path: CallStackEntry[]; selfTimeMs: number; selfTimePercent: number }> = []

	function traverse(node: CallTreeNode, path: CallStackEntry[]): void {
		const currentPath = [
			...path,
			{
				functionName: node.functionName,
				file: node.url,
				line: node.lineNumber
			}
		]

		// If this node has significant self-time, add it as a hot path
		if (node.selfTimeMs > 0) {
			paths.push({
				path: currentPath,
				selfTimeMs: node.selfTimeMs,
				selfTimePercent: node.selfTimePercent
			})
		}

		// Traverse children
		for (const child of node.children) {
			traverse(child, currentPath)
		}
	}

	traverse(root, [])

	// Sort by self-time and return top N
	return paths.sort((a, b) => b.selfTimeMs - a.selfTimeMs).slice(0, topN)
}

/**
 * Calculate time breakdown by code category
 */
export function calculateBreakdown(
	summaries: Map<string, FunctionSummary>
): Record<string, CategoryBreakdown> {
	const breakdown: Record<string, { timeMs: number; percent: number }> = {}

	for (const summary of summaries.values()) {
		const category = categorizeFile(summary.file)

		if (!breakdown[category]) {
			breakdown[category] = { timeMs: 0, percent: 0 }
		}

		breakdown[category].timeMs += summary.selfTimeMs
		breakdown[category].percent += summary.selfTimePercent
	}

	// Sort by time
	const sortedCategories = Object.entries(breakdown).sort(([, a], [, b]) => b.timeMs - a.timeMs)

	const result: Record<string, CategoryBreakdown> = {}
	for (const [category, data] of sortedCategories) {
		result[category] = data
	}

	return result
}

/**
 * Find the deepest BakeryJS-related call stack
 */
export function findDeepestBakeryJsStack(root: CallTreeNode): CallStackEntry[] {
	let deepestStack: CallStackEntry[] = []

	function traverse(node: CallTreeNode, depth: number): void {
		// Check if this is BakeryJS code
		const isBakeryJs = node.url && (node.url.includes('/src/') || node.url.includes('/benchmarks/'))

		if (isBakeryJs && node.hitCount > 0) {
			const stack = buildCallStack(node)
			if (stack.length > deepestStack.length) {
				deepestStack = stack
			}
		}

		for (const child of node.children) {
			traverse(child, depth + 1)
		}
	}

	traverse(root, 0)
	return deepestStack
}

/**
 * Summarize the percentage of time spent in each major component
 */
export function summarizeComponents(breakdown: Record<string, CategoryBreakdown>): {
	bakeryJsTotal: number
	nodeInternals: number
	dependencies: number
	benchmark: number
	other: number
} {
	return {
		bakeryJsTotal:
			(breakdown['TracingModel']?.percent || 0) +
			(breakdown['Flow']?.percent || 0) +
			(breakdown['Box']?.percent || 0) +
			(breakdown['Other BakeryJS']?.percent || 0),
		nodeInternals: breakdown['Node.js Internals']?.percent || 0,
		dependencies: breakdown['Dependencies']?.percent || 0,
		benchmark: breakdown['Benchmark']?.percent || 0,
		other: breakdown['Other']?.percent || breakdown['native']?.percent || 0
	}
}
