/**
 * Call Tree Data Structure
 *
 * Builds a call tree from parsed CPU profile data with self-time and total-time calculations
 */

import { CpuProfileNode, CallTreeNode, FunctionSummary } from '../types'
import {
	ParsedProfile,
	calculateSelfTimeMs,
	extractFilePath,
	isNativeOrInternal
} from './cpuProfileParser'

/** Options for building the call tree */
export interface CallTreeOptions {
	/** Include native and internal functions */
	includeInternals?: boolean
}

/**
 * Build a CallTreeNode from a CpuProfileNode
 */
function buildNode(
	profileNode: CpuProfileNode,
	parsed: ParsedProfile,
	totalProfileTimeMs: number,
	options: CallTreeOptions,
	parent?: CallTreeNode
): CallTreeNode {
	const selfTimeMs = calculateSelfTimeMs(profileNode, parsed.sampleIntervalUs)

	const node: CallTreeNode = {
		id: profileNode.id,
		functionName: profileNode.callFrame.functionName || '(anonymous)',
		url: profileNode.callFrame.url,
		lineNumber: profileNode.callFrame.lineNumber + 1, // Convert to 1-based
		columnNumber: profileNode.callFrame.columnNumber + 1,
		selfTimeMs,
		totalTimeMs: selfTimeMs, // Will be updated after building children
		hitCount: profileNode.hitCount,
		selfTimePercent: 0, // Will be calculated after totals
		totalTimePercent: 0,
		children: [],
		parent
	}

	// Build children recursively
	if (profileNode.children) {
		for (const childId of profileNode.children) {
			const childProfileNode = parsed.nodeMap.get(childId)
			if (childProfileNode) {
				// Skip internals if not requested
				if (!options.includeInternals && isNativeOrInternal(childProfileNode)) {
					// Still recurse to get their children
					if (childProfileNode.children) {
						for (const grandChildId of childProfileNode.children) {
							const grandChild = parsed.nodeMap.get(grandChildId)
							if (grandChild) {
								const grandChildNode = buildNode(
									grandChild,
									parsed,
									totalProfileTimeMs,
									options,
									node
								)
								node.children.push(grandChildNode)
							}
						}
					}
				} else {
					const childNode = buildNode(childProfileNode, parsed, totalProfileTimeMs, options, node)
					node.children.push(childNode)
				}
			}
		}
	}

	// Calculate total time by summing self time and all children's total time
	node.totalTimeMs = selfTimeMs + node.children.reduce((sum, child) => sum + child.totalTimeMs, 0)

	// Calculate percentages
	if (totalProfileTimeMs > 0) {
		node.selfTimePercent = (selfTimeMs / totalProfileTimeMs) * 100
		node.totalTimePercent = (node.totalTimeMs / totalProfileTimeMs) * 100
	}

	return node
}

/**
 * Build a call tree from a parsed profile
 */
export function buildCallTree(parsed: ParsedProfile, options: CallTreeOptions = {}): CallTreeNode {
	const totalProfileTimeMs = parsed.totalTimeUs / 1000
	const rootProfileNode = parsed.profile.nodes[0]

	if (!rootProfileNode) {
		throw new Error('Profile has no nodes')
	}

	return buildNode(rootProfileNode, parsed, totalProfileTimeMs, options)
}

/**
 * Aggregate function data across all call sites
 */
export function aggregateFunctions(root: CallTreeNode): Map<string, FunctionSummary> {
	const summaries = new Map<string, FunctionSummary>()

	function traverse(node: CallTreeNode): void {
		const key = `${node.functionName}:${node.url}:${node.lineNumber}`

		const existing = summaries.get(key)
		if (existing) {
			existing.selfTimeMs += node.selfTimeMs
			existing.totalTimeMs += node.totalTimeMs
			existing.selfTimePercent += node.selfTimePercent
			existing.totalTimePercent += node.totalTimePercent
			existing.hitCount += node.hitCount
		} else {
			summaries.set(key, {
				functionName: node.functionName,
				file: extractFilePath(node.url),
				lineNumber: node.lineNumber,
				selfTimeMs: node.selfTimeMs,
				totalTimeMs: node.totalTimeMs,
				selfTimePercent: node.selfTimePercent,
				totalTimePercent: node.totalTimePercent,
				hitCount: node.hitCount
			})
		}

		for (const child of node.children) {
			traverse(child)
		}
	}

	traverse(root)
	return summaries
}

/**
 * Get functions sorted by self time (hotspots)
 */
export function getHotspots(
	summaries: Map<string, FunctionSummary>,
	topN: number
): FunctionSummary[] {
	return Array.from(summaries.values())
		.sort((a, b) => b.selfTimeMs - a.selfTimeMs)
		.slice(0, topN)
}

/**
 * Get functions sorted by total time (bottlenecks)
 */
export function getBottlenecks(
	summaries: Map<string, FunctionSummary>,
	topN: number
): FunctionSummary[] {
	return Array.from(summaries.values())
		.sort((a, b) => b.totalTimeMs - a.totalTimeMs)
		.slice(0, topN)
}

/**
 * Find the deepest call stack in the tree
 */
export function getMaxDepth(node: CallTreeNode, currentDepth: number = 0): number {
	if (node.children.length === 0) {
		return currentDepth
	}

	return Math.max(...node.children.map(child => getMaxDepth(child, currentDepth + 1)))
}
