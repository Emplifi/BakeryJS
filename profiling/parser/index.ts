/**
 * Profile Parsing Entry Point
 *
 * Re-exports parser functionality and provides high-level parsing API
 */

// Re-export types and utilities
export {
	ParsedProfile,
	parseProfileFile,
	parseProfileJson,
	getNode,
	getRootNode,
	calculateSelfTimeMs,
	isNativeOrInternal,
	extractFilePath,
	isBakeryJsCode
} from './cpuProfileParser'

export {
	CallTreeOptions,
	buildCallTree,
	aggregateFunctions,
	getHotspots,
	getBottlenecks,
	getMaxDepth
} from './callTree'

import { CallTreeNode, FunctionSummary, ProfileMetadata } from '../types'
import { parseProfileFile, ParsedProfile } from './cpuProfileParser'
import { buildCallTree, aggregateFunctions, CallTreeOptions } from './callTree'

/** Result of parsing a profile */
export interface ParseResult {
	/** Profile metadata */
	metadata: ProfileMetadata
	/** Root of the call tree */
	callTree: CallTreeNode
	/** Aggregated function summaries */
	functionSummaries: Map<string, FunctionSummary>
	/** The raw parsed profile */
	parsedProfile: ParsedProfile
}

/**
 * Parse a CPU profile file and build the call tree
 *
 * This is the main entry point for profile parsing, combining
 * parsing and tree building into a single convenient function.
 *
 * @param filePath Path to the .cpuprofile file
 * @param options Options for parsing and tree building
 * @returns Parsed profile with call tree and function summaries
 */
export function parseProfile(filePath: string, options: CallTreeOptions = {}): ParseResult {
	// Parse the raw profile
	const parsedProfile = parseProfileFile(filePath)

	// Build the call tree
	const callTree = buildCallTree(parsedProfile, options)

	// Aggregate function data
	const functionSummaries = aggregateFunctions(callTree)

	return {
		metadata: parsedProfile.metadata,
		callTree,
		functionSummaries,
		parsedProfile
	}
}
