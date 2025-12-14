/**
 * Node.js process spawner with CPU profiling enabled
 */

import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'

/** Options for spawning a profiled process */
export interface ProfileSpawnOptions {
	/** Directory to store CPU profile files */
	profileDir: string
	/** Working directory for the spawned process */
	cwd?: string
	/** Environment variables to pass to the process */
	env?: NodeJS.ProcessEnv
	/** Timeout in milliseconds (0 = no timeout) */
	timeout?: number
}

/** Result of spawning a profiled process */
export interface SpawnResult {
	/** Exit code of the process */
	exitCode: number | null
	/** Path to the generated CPU profile file */
	profilePath: string | null
	/** stdout output */
	stdout: string
	/** stderr output */
	stderr: string
	/** Duration of the process in milliseconds */
	durationMs: number
}

/**
 * Ensure the profile directory exists
 */
export function ensureProfileDir(profileDir: string): void {
	if (!fs.existsSync(profileDir)) {
		fs.mkdirSync(profileDir, { recursive: true })
	}
}

/**
 * Find the most recently created .cpuprofile file in a directory
 */
export function findLatestProfile(profileDir: string): string | null {
	if (!fs.existsSync(profileDir)) {
		return null
	}

	const files = fs
		.readdirSync(profileDir)
		.filter(f => f.endsWith('.cpuprofile'))
		.map(f => ({
			name: f,
			path: path.join(profileDir, f),
			mtime: fs.statSync(path.join(profileDir, f)).mtime.getTime()
		}))
		.sort((a, b) => b.mtime - a.mtime)

	const firstFile = files[0]
	return firstFile ? firstFile.path : null
}

/**
 * Spawn a Node.js process with CPU profiling enabled
 *
 * @param scriptPath Path to the script to run
 * @param scriptArgs Arguments to pass to the script
 * @param options Spawn options
 * @returns Promise resolving to spawn result
 */
export function spawnWithProfiling(
	scriptPath: string,
	scriptArgs: string[],
	options: ProfileSpawnOptions
): Promise<SpawnResult> {
	return new Promise((resolve, reject) => {
		const startTime = Date.now()
		ensureProfileDir(options.profileDir)

		// Get profiles before running to identify new ones later
		const existingProfiles = new Set(
			fs.existsSync(options.profileDir)
				? fs.readdirSync(options.profileDir).filter(f => f.endsWith('.cpuprofile'))
				: []
		)

		// Node.js args for CPU profiling
		const nodeArgs = [
			'--cpu-prof',
			`--cpu-prof-dir=${options.profileDir}`,
			'--require',
			'ts-node/register',
			scriptPath,
			...scriptArgs
		]

		const cwd = options.cwd || process.cwd()
		const env = { ...process.env, ...options.env }

		let stdout = ''
		let stderr = ''
		let timedOut = false
		let timeoutHandle: NodeJS.Timeout | null = null

		const child: ChildProcess = spawn('node', nodeArgs, {
			cwd,
			env,
			stdio: ['inherit', 'pipe', 'pipe']
		})

		if (child.stdout) {
			child.stdout.on('data', (data: Buffer) => {
				const str = data.toString()
				stdout += str
				process.stdout.write(str)
			})
		}

		if (child.stderr) {
			child.stderr.on('data', (data: Buffer) => {
				const str = data.toString()
				stderr += str
				process.stderr.write(str)
			})
		}

		if (options.timeout && options.timeout > 0) {
			timeoutHandle = setTimeout(() => {
				timedOut = true
				child.kill('SIGTERM')
			}, options.timeout)
		}

		child.on('error', err => {
			if (timeoutHandle) clearTimeout(timeoutHandle)
			reject(err)
		})

		child.on('close', code => {
			if (timeoutHandle) clearTimeout(timeoutHandle)
			const durationMs = Date.now() - startTime

			// Find the newly created profile file
			let profilePath: string | null = null
			if (fs.existsSync(options.profileDir)) {
				const currentProfiles = fs
					.readdirSync(options.profileDir)
					.filter(f => f.endsWith('.cpuprofile'))
				const newProfiles = currentProfiles.filter(f => !existingProfiles.has(f))
				const firstNewProfile = newProfiles[0]
				if (firstNewProfile) {
					profilePath = path.join(options.profileDir, firstNewProfile)
				}
			}

			if (timedOut) {
				resolve({ exitCode: code, profilePath, stdout, stderr, durationMs })
			} else {
				resolve({ exitCode: code, profilePath, stdout, stderr, durationMs })
			}
		})
	})
}
