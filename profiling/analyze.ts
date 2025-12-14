#!/usr/bin/env npx ts-node
/**
 * BakeryJS CPU Profile Analysis Entry Point
 *
 * Analyzes CPU profiles and generates hotspot reports.
 *
 * Usage:
 *   npm run profile:analyze                              # Analyze most recent profile
 *   npm run profile:analyze -- --file=<path>             # Analyze specific profile
 *   npm run profile:analyze -- --json                    # Output JSON format
 *   npm run profile:analyze -- --baseline=<path>         # Compare against baseline
 */

import { parseProfilingArgs, printAnalysisHeader } from './cli'
import { findMostRecentProfile } from './collector'
import { parseProfile } from './parser'
import { analyzeProfile } from './analyzer'
import { generateReport, printCiSummary, getExitCode, loadAnalysisResult } from './reporter'

/**
 * Main entry point for profile analysis
 */
async function main(): Promise<void> {
	const args = parseProfilingArgs()

	// Find the profile to analyze
	let profilePath = args.file
	if (!profilePath) {
		profilePath = findMostRecentProfile() ?? undefined
		if (!profilePath) {
			console.error('No profile files found. Run "npm run profile" first to collect a profile.')
			process.exit(1)
		}
	}

	if (!args.json) {
		printAnalysisHeader(args)
		console.log(`Analyzing: ${profilePath}`)
		console.log()
	}

	// Parse the profile
	let parseResult
	try {
		parseResult = parseProfile(profilePath, {
			includeInternals: args.includeInternals
		})
	} catch (err) {
		console.error(`Failed to parse profile: ${(err as Error).message}`)
		process.exit(1)
	}

	// Load baseline if provided
	let baselineResult = undefined
	if (args.baseline) {
		baselineResult = loadAnalysisResult(args.baseline) ?? undefined
		if (!baselineResult) {
			console.error(`Failed to load baseline: ${args.baseline}`)
			process.exit(1)
		}
	}

	// Analyze the profile
	const analysisResult = analyzeProfile(parseResult, {
		thresholds: {
			hotspotSelfTimePercent: args.hotspotThreshold,
			regressionChangePercent: args.regressionThreshold,
			topN: args.topN
		},
		includeInternals: args.includeInternals,
		baseline: baselineResult
	})

	// Generate report
	const savedPath = generateReport(analysisResult, {
		json: args.json,
		outputPath: args.output
	})

	if (savedPath && !args.json) {
		console.log(`\nResults saved to: ${savedPath}`)
	}

	// Print CI summary
	if (!args.json) {
		console.log()
		printCiSummary(analysisResult)
	}

	// Exit with appropriate code
	process.exit(getExitCode(analysisResult))
}

main().catch(err => {
	console.error('Profile analysis failed:', err)
	process.exit(1)
})
