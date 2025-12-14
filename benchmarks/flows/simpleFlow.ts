/**
 * Simple Flow Definition for Benchmarking
 *
 * A minimal flow to establish baseline performance:
 * [job] → [configurable-generator (N items)] → [mapper1] → [mapper2] → [drain]
 *
 * This flow has:
 * - 1 generator: Produces N messages
 * - 2 mappers: Simple transformations
 * - 1 dimension: Root dimension only
 */

import {FlowExplicitDescription} from '../../src/lib/bakeryjs/FlowBuilderI';

/**
 * Creates a simple flow configuration with the specified item count
 * @param itemCount Number of items for the generator to produce
 * @returns Flow description for the simple benchmark flow
 */
export function createSimpleFlow(itemCount: number): FlowExplicitDescription {
	return {
		process: [
			[
				{
					'configurable-generator': [['mapper1'], ['mapper2']],
				},
			],
		],
		parameters: {
			'configurable-generator': itemCount,
		},
	};
}

/**
 * Default simple flow configuration
 */
export const simpleFlow: FlowExplicitDescription = createSimpleFlow(100);

export default simpleFlow;

