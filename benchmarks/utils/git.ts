/**
 * Git utilities for benchmark runner
 */

import { execSync } from 'child_process'

/**
 * Get the current git commit SHA
 * @returns The git commit SHA or undefined if not in a git repository
 */
export function getGitCommitSha(): string | undefined {
	try {
		return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
	} catch {
		return undefined
	}
}
