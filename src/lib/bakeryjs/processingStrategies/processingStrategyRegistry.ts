import type { ProcessingStrategy } from './ProcessingStrategy'
import { ProcessingMode } from './ProcessingMode'
import { MapperStrategy } from './MapperStrategy'
import { GeneratorStrategy } from './GeneratorStrategy'
import { AggregatorStrategy } from './AggregatorStrategy'

/**
 * Registry of processing strategies keyed by ProcessingMode.
 *
 * To add a new processing mode:
 * 1. Add the new enum value to ProcessingMode
 * 2. Create the new strategy class implementing ProcessingStrategy
 * 3. Add the new entry to this registry
 *
 * This follows the Open/Closed Principle - Box.ts remains closed for modification.
 */
export const processingStrategyRegistry: Record<ProcessingMode, ProcessingStrategy> = {
	[ProcessingMode.Mapper]: new MapperStrategy(),
	[ProcessingMode.Generator]: new GeneratorStrategy(),
	[ProcessingMode.Aggregator]: new AggregatorStrategy()
}

/**
 * Gets the processing strategy for a given mode.
 * @param mode - The processing mode
 * @returns The corresponding strategy
 * @throws Error if no strategy is registered for the mode
 */
export function getProcessingStrategy(mode: ProcessingMode): ProcessingStrategy {
	const strategy = processingStrategyRegistry[mode]
	if (!strategy) {
		throw new Error(`No processing strategy registered for mode: ${mode}`)
	}
	return strategy
}
