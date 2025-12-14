import type { BoxMeta, BatchingBoxMeta } from '../BoxI'

/**
 * Processing modes that a Box can operate in.
 * Each mode determines how messages are processed.
 */
export enum ProcessingMode {
	Mapper = 'mapper',
	Generator = 'generator',
	Aggregator = 'aggregator'
}

/**
 * Determines the processing mode from box metadata.
 * Single source of truth for mode determination logic.
 *
 * @param meta - The box metadata
 * @returns The processing mode
 */
export function getProcessingMode(meta: BoxMeta | BatchingBoxMeta): ProcessingMode {
	if (meta.aggregates) {
		return ProcessingMode.Aggregator
	}
	// Only BoxMeta has emits property
	if ('emits' in meta && (meta as BoxMeta).emits.length > 0) {
		return ProcessingMode.Generator
	}
	return ProcessingMode.Mapper
}
