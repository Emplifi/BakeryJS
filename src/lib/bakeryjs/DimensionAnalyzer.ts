/**
 * DimensionAnalyzer - Analyzes flow graph to extract dimension structure.
 *
 * The dimension structure describes the (partial) order the completion of
 * particular dimensions must occur. The structure is a tree where:
 * - The root is an empty dimension (top level)
 * - Other dimensions are nodes with edges oriented from child to parent
 * - Each dimension holds a list of boxes belonging to it
 *
 * During analysis, dimension mismatches can be uncovered. A mismatch means
 * the dimensions cannot be ordered into a tree and a DAG would be required.
 * Such a flow is invalid and an exception is thrown.
 */

import type { DiGraph, AttributeDict, Node } from 'sb-jsnetworkx'
import { DiGraph as DiGraphClass, topologicalSort } from 'sb-jsnetworkx'
import type { BatchingBoxMeta, BoxMeta } from './BoxI'
import { deepStrictEqual } from 'assert'
import { ROOT_NODE } from './builders/DAGBuilder/builder'

/**
 * Analyzes box graph and builds dimension graph.
 */
export class DimensionAnalyzer {
	/**
	 * Analyzes the flow graph and extracts the dimensions structure.
	 * Adds 'dimension' attribute to each node in the graph.
	 *
	 * @param graph - Box graph with edges from depending boxes to providing boxes
	 * @returns Dimension graph with boxes grouped by dimension
	 */
	public analyze(graph: DiGraph): DiGraph {
		const dimGraph = this.initializeDimensionGraph()
		this.initializeRootNode(graph)

		const boxOrder = this.getTopologicalOrder(graph)
		this.processBoxesInOrder(boxOrder, graph, dimGraph)

		return dimGraph
	}

	private initializeDimensionGraph(): DiGraph {
		const dimGraph: DiGraph = new DiGraphClass()
		dimGraph.addNode([], { boxes: [ROOT_NODE] })
		return dimGraph
	}

	private initializeRootNode(graph: DiGraph): void {
		graph.addNode(ROOT_NODE, { dimension: [] })
	}

	private getTopologicalOrder(graph: DiGraph): string[] {
		// Edges point from depending to providing, so reverse for top-to-bottom
		return (topologicalSort(graph) as string[]).reverse().slice(1) // Skip ROOT_NODE
	}

	private processBoxesInOrder(boxOrder: string[], graph: DiGraph, dimGraph: DiGraph): void {
		boxOrder.forEach(boxName => this.assignBoxDimension(boxName, graph, dimGraph))
	}

	private assignBoxDimension(boxName: string, graph: DiGraph, dimGraph: DiGraph): void {
		const parentDimension = this.getParentDimension(boxName, graph)
		const myMeta = this.getBoxMeta(boxName, graph)
		const myDimension = this.calculateDimension(myMeta, parentDimension)

		this.ensureDimensionNode(myDimension, parentDimension, dimGraph)
		this.validateAndSetDimension(boxName, myDimension, graph, dimGraph)
	}

	private getParentDimension(boxName: string, graph: DiGraph): Node[] {
		const outEdges = graph.outEdges(boxName)
		const firstEdge = outEdges[0]
		if (!firstEdge) {
			throw new Error(`No parent edge found for box ${boxName}`)
		}
		const parentNode: Node = firstEdge[1]
		return (graph.node.get(parentNode) as AttributeDict).dimension
	}

	private getBoxMeta(boxName: string, graph: DiGraph): BoxMeta | BatchingBoxMeta {
		return (graph.node.get(boxName) as AttributeDict).instance.meta
	}

	private calculateDimension(meta: BoxMeta | BatchingBoxMeta, parentDim: Node[]): Node[] {
		if (this.isGenerator(meta)) {
			return parentDim.concat((meta as BoxMeta).emits)
		}
		if (!meta.aggregates) {
			return parentDim // Mapper: same dimension
		}
		return parentDim.slice(0, -1) // Aggregator: one level up
	}

	private isGenerator(meta: BoxMeta | BatchingBoxMeta): boolean {
		return Boolean((meta as BoxMeta).emits && (meta as BoxMeta).emits.length > 0)
	}

	private ensureDimensionNode(dimension: Node[], parentDimension: Node[], dimGraph: DiGraph): void {
		if (!dimGraph.hasNode(dimension)) {
			dimGraph.addNode(dimension, { boxes: [] })
			dimGraph.addEdge(dimension, parentDimension)
		}
	}

	private validateAndSetDimension(
		boxName: string,
		dimension: Node[],
		graph: DiGraph,
		dimGraph: DiGraph
	): void {
		const existingDimension = (graph.node.get(boxName) as AttributeDict).dimension

		if (existingDimension) {
			this.validateDimensionMatch(boxName, existingDimension, dimension)
		} else {
			graph.addNode(boxName, { dimension })
			;(dimGraph.node.get(dimension) as AttributeDict).boxes.push(boxName)
		}
	}

	private validateDimensionMatch(boxName: string, existing: Node[], expected: Node[]): void {
		deepStrictEqual(
			existing,
			expected,
			`Dimensions mismatch. The flow data dimensions are inconsistent in box ${boxName}`
		)
	}
}
