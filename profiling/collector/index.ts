/**
 * Profile collection orchestration
 */

import * as path from 'path'
import * as fs from 'fs'
import { ProfilingArgs } from '../cli'
import { spawnWithProfiling, findLatestProfile, SpawnResult, ensureProfileDir } from './spawner'
import { getGitCommitSha } from '../../benchmarks/utils/git'

/** Profile collection result */
export interface CollectionResult {
	/** Path to the generated profile */
	profilePath: string | null
	/** Duration of the collection in milliseconds */
	durationMs: number
	/** Exit code of the benchmark process */
	exitCode: number | null
	/** Whether collection was successful */
	success: boolean
	/** Error message if failed */
	error?: string
	/** Metadata about the collection */
	metadata: {
		flowType: 'simple' | 'complex'
		items: number
		nested: number
		warmup: number
		duration: number
		timestamp: string
		gitCommitSha?: string
	}
}

/** Directory for storing profiles */
const PROFILES_DIR = path.join(__dirname, '..', 'profiles')

/**
 * Collect a CPU profile by running the benchmark flow
 */
export async function collectProfile(args: ProfilingArgs): Promise<CollectionResult> {
	const timestamp = new Date().toISOString()

	const metadata = {
		flowType: args.flowType,
		items: args.items,
		nested: args.nested,
		warmup: args.warmup,
		duration: args.duration,
		timestamp,
		gitCommitSha: getGitCommitSha()
	}

	ensureProfileDir(PROFILES_DIR)

	// Build the benchmark script arguments
	const scriptArgs = [
		`--flow=${args.flowType}`,
		`--items=${args.items}`,
		`--nested=${args.nested}`,
		`--timeout=${args.warmup + args.duration}`
	]

	const benchmarkScript = path.join(__dirname, '..', '..', 'benchmarks', 'run.ts')

	console.log(`\nStarting profile collection...`)
	console.log(`  Flow: ${args.flowType}`)
	console.log(`  Items: ${args.items}, Nested: ${args.nested}`)
	console.log(`  Warmup: ${args.warmup}s, Duration: ${args.duration}s`)
	console.log()

	let result: SpawnResult

	try {
		result = await spawnWithProfiling(benchmarkScript, scriptArgs, {
			profileDir: PROFILES_DIR,
			cwd: path.join(__dirname, '..', '..'),
			timeout: (args.warmup + args.duration + 30) * 1000 // Extra 30s buffer
		})
	} catch (err) {
		return {
			profilePath: null,
			durationMs: 0,
			exitCode: null,
			success: false,
			error: `Failed to spawn benchmark process: ${(err as Error).message}`,
			metadata
		}
	}

	if (!result.profilePath) {
		// Try to find the latest profile anyway
		const latestProfile = findLatestProfile(PROFILES_DIR)
		if (latestProfile) {
			result.profilePath = latestProfile
		}
	}

	const success = result.exitCode === 0 && result.profilePath !== null

	return {
		profilePath: result.profilePath,
		durationMs: result.durationMs,
		exitCode: result.exitCode,
		success,
		error: success ? undefined : `Process exited with code ${result.exitCode}`,
		metadata
	}
}

/**
 * Find the most recent profile file
 */
export function findMostRecentProfile(): string | null {
	return findLatestProfile(PROFILES_DIR)
}

/**
 * Get the profiles directory path
 */
export function getProfilesDir(): string {
	return PROFILES_DIR
}

/**
 * List all available profile files
 */
export function listProfiles(): string[] {
	if (!fs.existsSync(PROFILES_DIR)) {
		return []
	}

	return fs
		.readdirSync(PROFILES_DIR)
		.filter(f => f.endsWith('.cpuprofile'))
		.map(f => path.join(PROFILES_DIR, f))
		.sort()
		.reverse() // Most recent first (alphabetically sorted by name with timestamp)
}

/**
 * Save collection metadata alongside the profile
 */
export function saveCollectionMetadata(result: CollectionResult): void {
	if (!result.profilePath) {
		return
	}

	const metadataPath = result.profilePath.replace('.cpuprofile', '.metadata.json')
	fs.writeFileSync(metadataPath, JSON.stringify(result.metadata, null, 2))
}
