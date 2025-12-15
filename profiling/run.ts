#!/usr/bin/env npx ts-node
/**
 * BakeryJS CPU Profile Collection Entry Point
 *
 * Collects CPU profiles by running benchmark flows with Node.js --cpu-prof flag.
 *
 * Usage:
 *   npm run profile                    # Run profiling with defaults
 *   npm run profile -- --duration=60   # Run for 60 seconds
 *   npm run profile -- --flow=simple   # Run simple flow
 *   npm run profile -- --items=1000    # Run with 1000 items
 */

import { parseProfilingArgs, printProfilingHeader } from './cli'
import { collectProfile, saveCollectionMetadata } from './collector'

/**
 * Main entry point for profile collection
 */
async function main(): Promise<void> {
	const args = parseProfilingArgs()

	printProfilingHeader(args)

	console.log('Collecting CPU profile...')
	console.log('(This will run the benchmark with Node.js --cpu-prof flag)')
	console.log()

	const result = await collectProfile(args)

	if (result.success && result.profilePath) {
		saveCollectionMetadata(result)
		console.log()
		console.log('=' + '='.repeat(59))
		console.log('Profile Collection Complete')
		console.log('=' + '='.repeat(59))
		console.log(`Profile: ${result.profilePath}`)
		console.log(`Duration: ${(result.durationMs / 1000).toFixed(1)}s`)
		console.log()
		console.log('To analyze this profile, run:')
		console.log(`  npm run profile:analyze -- --file=${result.profilePath}`)
		console.log()
		console.log('Or analyze the most recent profile:')
		console.log('  npm run profile:analyze')
	} else {
		console.error()
		console.error('Profile collection failed!')
		if (result.error) {
			console.error(`Error: ${result.error}`)
		}
		process.exit(1)
	}
}

main().catch(err => {
	console.error('Profile collection failed:', err)
	process.exit(1)
})
