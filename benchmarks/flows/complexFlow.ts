/**
 * Complex Flow Definition for Benchmarking
 *
 * A deeply nested flow to stress-test the TracingModel:
 *
 * [job] → [gen1 (N items)] → [mapper1] → [mapper2] → [mapper3]
 *                                ↓
 *                           [gen2 (M items)] → [mapper4] → [mapper5]
 *                                                 ↓
 *                            [parallel: mapper6, mapper7, mapper8]
 *                                                 ↓
 *                                            [mapper9]
 *
 * This flow has:
 * - 2 generators: Creates nested dimensions
 * - 9 mappers: Including parallel processing stages
 * - 3 dimensions: Root, gen1's dimension (benchmark_items), gen2's dimension (benchmark_nested_items)
 *
 * Total messages processed = N * M (for the nested dimension)
 * TracingModel must track: N messages at level 1, N*M messages at level 2
 */

import {FlowExplicitDescription} from '../../src/lib/bakeryjs/FlowBuilderI';

/**
 * Creates a complex flow configuration with the specified item counts
 * @param itemCount Number of items for the first generator (N)
 * @param nestedItemCount Number of items per parent for the nested generator (M)
 * @returns Flow description for the complex benchmark flow
 */
export function createComplexFlow(
	itemCount: number,
	nestedItemCount: number
): FlowExplicitDescription {
	return {
		process: [
			[
				{
					// First generator creates N items
					'configurable-generator': [
						// Stage 1: Initial mappers in the first dimension
						['mapper1', 'mapper2', 'mapper3'],
						// Stage 2: Nested generator with its sub-flow
						[
							{
								// Second generator creates M items per parent = N*M total
								'nested-generator': [
									// Stage 1 in nested dimension
									['mapper4', 'mapper5'],
									// Stage 2: Parallel mappers
									['mapper6', 'mapper7', 'mapper8'],
									// Stage 3: Final mapper
									['mapper9'],
								],
							},
						],
					],
				},
			],
		],
		parameters: {
			'configurable-generator': itemCount,
			'nested-generator': nestedItemCount,
		},
	};
}

/**
 * Default complex flow configuration
 * N=100 first level items, M=10 nested items = 1000 total leaf messages
 */
export const complexFlow: FlowExplicitDescription = createComplexFlow(100, 10);

export default complexFlow;

