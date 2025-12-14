import type { default as FlowBuilderI } from '../../FlowBuilderI'
import type {
	FlowExplicitDescription,
	SchemaComponent,
	SchemaObject,
	SerialSchemaComponent
} from '../../FlowBuilderI'
import { DiGraph, topologicalSort } from 'sb-jsnetworkx'
import type { Edge, EdgeWithAttribs, NodeWithAttribs } from 'sb-jsnetworkx'
import type ComponentFactoryI from '../../ComponentFactoryI'
import type { PriorityQueueI } from '../../queue/PriorityQueueI'
import type { Message } from '../../Message'
import type { BatchingBoxInterface, BatchingBoxMeta, BoxInterface, BoxMeta } from '../../BoxI'
import { QZip, Tee } from './joinedQueue'
import { FastPriorityBatchQueue, FastPriorityQueue } from '../../queue/FastPriorityQueue'
import { ok as assert } from 'assert'
import { eventEmitter } from '../../stats'
import { Flow } from '../../Flow'

const DEFAULT_BATCH_TIMEOUT_SEC = 0.2
export const ROOT_NODE = '_root_'

/**
 * Build recursively a directed graph from the SchemaObject.
 * TODO: (idea2) Analyze the graph in external logical program (SWI Prolog)
 * TODO: (idea2) Doesn't account for aggregators.  Generators in graph can't have sons in common with its siblings.
 *
 * Every row of boxes depend on the previous row of **mappers**.  Any generator affects only
 * boxes in its "subgraph".  Until we have implemented aggregators (and syntax for them), at least.
 *
 * @param schema The rest of the schema not analyzed yet
 * @param previous the last *ConcurrentSchemaComponent* analyzed.  These will be the successors of the
 * next analyzed level
 * @param analyzed the graph of already analyzed boxes and relationships
 * @private
 */
function _analyzeRecursive(
	schema: SerialSchemaComponent,
	previous: string[],
	analyzed: DiGraph
): DiGraph {
	// return if nothing to do
	if (schema.length == 0) {
		return analyzed
	}

	// current row of SchemaComponents to analyze and to include into the graph
	const currentRow = schema[0]
	if (!currentRow) {
		return analyzed
	}
	const rest = schema.slice(1)
	// the generators of the current row
	const gens: SchemaComponent[] = currentRow.filter(
		(obj: SchemaComponent) => typeof obj !== 'string'
	)
	// the mappers of the current row
	const maps: SchemaComponent[] = currentRow.filter(
		(obj: string | SchemaObject) => typeof obj === 'string'
	)

	// each of the current row depends on each of the previous row
	// note that the edge orientation is reversed
	currentRow.forEach((box: SchemaComponent) => {
		const boxNames: string[] = typeof box === 'string' ? [box] : Object.keys(box)
		boxNames.forEach(boxName => {
			analyzed.addEdgesFrom(previous.map((pBox: string) => [boxName, pBox] as Edge))
		})
	})

	// For each generator, analyze its subgraph depending solely on the generator
	;(gens as SchemaObject[]).forEach((gen: SchemaObject) => {
		for (const parentName of Object.keys(gen)) {
			const subSchema = gen[parentName]
			if (subSchema) {
				_analyzeRecursive(subSchema, [parentName], analyzed)
			}
		}
	})

	// we have completed the row, so proceed the rest
	return _analyzeRecursive(rest, maps as string[], analyzed)
}

/**
 * Build a directed graph from schema.  The nodes are the boxes.  There is an edge from box A into box B iff
 * box B sends data into A (i.e. box A follows **after** box B, the opposite way one would expect).
 *
 * @param schema Schema of the flow.
 * @private
 */
function analyzeSchema(schema: SerialSchemaComponent): DiGraph {
	const graph: DiGraph = new DiGraph()
	graph.addNode(ROOT_NODE)
	return _analyzeRecursive(schema, [ROOT_NODE], graph)
}

type FlowBoxesMetadata = {
	[index: string]: BoxMeta | BatchingBoxMeta
}

/**
 *
 * @param boxNames names of the boxes in the flow
 * @param boxBMeta building metainformation collected while building the DAG
 * @param schema the definition of the schema, to identify "source" of the event
 */
//TODO: extract into EEmiter of the flow itself
// when emitting from stats EE, we can't distinguish events of various flows
function emitFlowSchema(boxNames: string[], graph: DiGraph, schema: FlowExplicitDescription): void {
	const edges = graph.inEdges()
	const boxMetas: FlowBoxesMetadata = graph
		.nodes(true)
		.filter((n: NodeWithAttribs) => n[0] !== ROOT_NODE)
		.map((n: NodeWithAttribs) => {
			return {
				name: n[0],
				meta: (n[1].instance as BoxInterface | BatchingBoxInterface).meta
			}
		})
		.reduce((metas, item) => {
			metas[item.name as string] = item.meta
			return metas
		}, {} as FlowBoxesMetadata)

	eventEmitter.emit('flowSchema', schema, boxMetas, edges)
	return
}

/**
 * Builder that connects the boxes into directed acyclic graph based on their dependences.
 * TODO: (idea2) use some logical/analytical language (SWI Prolog?), don't even figure the instantiation order of the
 * particular boxes (from the flow-outgoing queues) and their flow-incoming queues.
 */
export class DAGBuilder implements FlowBuilderI {
	/**
	 * Main build method - orchestrates the flow construction process.
	 * CC: ~3 (sequential method calls)
	 */
	public async build(
		schema: FlowExplicitDescription,
		componentFactory: ComponentFactoryI,
		drain?: PriorityQueueI<Message>
	): Promise<Flow> {
		const graph: DiGraph = analyzeSchema(schema['process'])
		const boxBuildOrder: string[] = topologicalSort(graph) as string[]

		await this.instantiateAllBoxes(boxBuildOrder, graph, schema, componentFactory, drain)
		const rootQ = this.getRootQueue(graph)

		emitFlowSchema(boxBuildOrder, graph, schema)
		graph.addNode(ROOT_NODE, { input: rootQ })

		return new Flow(rootQ, graph)
	}

	/**
	 * Instantiates all boxes in topological order.
	 * CC: ~2 (loop + await)
	 */
	private async instantiateAllBoxes(
		boxBuildOrder: string[],
		graph: DiGraph,
		schema: FlowExplicitDescription,
		componentFactory: ComponentFactoryI,
		drain?: PriorityQueueI<Message>
	): Promise<void> {
		for (const boxName of boxBuildOrder) {
			if (boxName === ROOT_NODE) {
				continue
			}
			await this.instantiateBox(boxName, graph, schema, componentFactory, drain)
			this.wireBoxInputQueues(boxName, graph)
		}
	}

	/**
	 * Instantiates a single box and assigns its output queue.
	 * CC: ~4 (branching on depsQueues count)
	 */
	private async instantiateBox(
		boxName: string,
		graph: DiGraph,
		schema: FlowExplicitDescription,
		componentFactory: ComponentFactoryI,
		drain?: PriorityQueueI<Message>
	): Promise<void> {
		const depsQueues = this.getDependencyQueues(boxName, graph)
		const myParams = this.getBoxParams(boxName, schema)
		const outputQueue = this.resolveOutputQueue(depsQueues)

		const instance = await componentFactory.create(boxName, outputQueue ?? drain, myParams)
		graph.addNode(boxName, { instance })
	}

	/**
	 * Gets queues from boxes that depend on this box.
	 * CC: ~1
	 */
	private getDependencyQueues(boxName: string, graph: DiGraph): PriorityQueueI<Message>[] {
		return graph.inEdges(boxName, true).map((edgeInfo: EdgeWithAttribs) => edgeInfo[2].queue)
	}

	/**
	 * Gets parameters for a box from schema.
	 * CC: ~2
	 */
	private getBoxParams(boxName: string, schema: FlowExplicitDescription): any {
		return schema.parameters ? ((schema.parameters as any)[boxName] as any) : undefined
	}

	/**
	 * Resolves the output queue based on dependency queues.
	 * CC: ~3 (branching on queue count)
	 */
	private resolveOutputQueue(
		depsQueues: PriorityQueueI<Message>[]
	): PriorityQueueI<Message> | undefined {
		if (depsQueues.length === 0) {
			return undefined // Terminal box - will use drain
		}
		if (depsQueues.length === 1) {
			return depsQueues[0]
		}
		return new Tee(...depsQueues)
	}

	/**
	 * Creates and wires input queues for a box.
	 * CC: ~4 (batch check + loop)
	 */
	private wireBoxInputQueues(boxName: string, graph: DiGraph): void {
		const instance = (graph.node.get(boxName) as any).instance
		assert(instance !== undefined)

		const inputQueue = this.createInputQueue(instance, boxName)
		graph.addNode(boxName, { input: inputQueue })

		this.wireInputEdges(boxName, graph, inputQueue)
	}

	/**
	 * Creates the appropriate input queue (batch or single) for a box.
	 * CC: ~2
	 */
	private createInputQueue(
		instance: BoxInterface | BatchingBoxInterface,
		boxName: string
	): PriorityQueueI<Message> {
		const batchMeta = (instance as BatchingBoxInterface).meta.batch
		if (batchMeta) {
			return new FastPriorityBatchQueue(
				(msgs: Message[]) => (instance as BatchingBoxInterface).process(msgs),
				{
					concurrency: instance.meta.concurrency ?? 1,
					batch: {
						size: batchMeta.maxSize,
						waitMs: (batchMeta.timeoutSeconds ?? DEFAULT_BATCH_TIMEOUT_SEC) * 1000
					}
				},
				boxName
			)
		}
		return new FastPriorityQueue(
			(msg: Message) => (instance as BoxInterface).process(msg),
			{ concurrency: instance.meta.concurrency ?? 1 },
			boxName
		)
	}

	/**
	 * Wires input edges by setting up queues between boxes.
	 * CC: ~3
	 */
	private wireInputEdges(
		boxName: string,
		graph: DiGraph,
		inputQueue: PriorityQueueI<Message>
	): void {
		const inputs: Edge[] = graph.outEdges(boxName)
		const inputQs: PriorityQueueI<Message>[] =
			inputs.length === 1 ? [inputQueue] : new QZip(inputQueue, inputs.length).inputs

		for (let index = 0; index < inputs.length; index++) {
			const inEdge = inputs[index]
			const inputQ = inputQs[index]
			if (!inEdge || !inputQ) {
				continue
			}
			const providingBox: string = inEdge[1] as string
			inputQ.source = providingBox
			graph.addEdge(boxName, providingBox, { queue: inputQ })
		}
	}

	/**
	 * Gets the root queue from the graph (entry point into the flow).
	 * CC: ~2
	 */
	private getRootQueue(graph: DiGraph): PriorityQueueI<Message> {
		const depsQueues: PriorityQueueI<Message>[] = graph
			.inEdges(ROOT_NODE, true)
			.map((edgeInfo: EdgeWithAttribs) => edgeInfo[2].queue)

		if (depsQueues.length === 1 && depsQueues[0]) {
			return depsQueues[0]
		}
		return new Tee(...depsQueues)
	}
}
