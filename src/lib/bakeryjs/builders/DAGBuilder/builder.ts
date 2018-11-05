import {
	ConcurrentSchemaComponent,
	default as FlowBuilderI,
	FlowExplicitDescription,
	SchemaComponent,
	SchemaObject,
	SerialSchemaComponent,
} from '../../FlowBuilderI';
import {
	DiGraph,
	Edge,
	EdgeWithAttribs,
	NodeWithAttribs,
	topologicalSort,
} from 'jsnetworkx';
import ComponentFactoryI from '../../ComponentFactoryI';
import {PriorityQueueI} from '../../queue/PriorityQueueI';
import {Message} from '../../Message';
import {
	BatchingBoxInterface,
	BatchingBoxMeta,
	BoxInterface,
	BoxMeta,
} from '../../BoxI';
import {QZip, Tee} from './joinedQueue';
import {
	MemoryPriorityBatchQueue,
	MemoryPrioritySingleQueue,
} from '../../queue/MemoryPriorityQueue';
import {noopQueue} from '../../Box';
import {ok as assert} from 'assert';
import {eventEmitter} from '../../stats';
import {Flow} from '../../Flow';

const DEFAULT_BATCH_TIMEOUT_SEC = 0.2;
export const ROOT_NODE = '_root_';

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
		return analyzed;
	}

	// current row of SchemaComponents to analyze and to include into the graph
	const currentRow: ConcurrentSchemaComponent = schema[0];
	const rest = schema.slice(1);
	// the generators of the current row
	const gens: SchemaComponent[] = currentRow.filter(
		(obj: SchemaComponent) => typeof obj !== 'string'
	);
	// the mappers of the current row
	const maps: SchemaComponent[] = currentRow.filter(
		(obj: string | SchemaObject) => typeof obj === 'string'
	);

	// each of the current row depends on each of the previous row
	// note that the edge orientation is reversed
	currentRow.forEach((box: SchemaComponent) => {
		const boxNames: string[] =
			typeof box === 'string' ? [box] : Object.keys(box);
		boxNames.forEach((boxName) => {
			analyzed.addEdgesFrom(
				previous.map((pBox: string) => [boxName, pBox] as Edge)
			);
		});
	});

	// For each generator, analyze its subgraph depending solely on the generator
	(gens as SchemaObject[]).forEach((gen: SchemaObject) => {
		for (const parentName of Object.keys(gen)) {
			_analyzeRecursive(gen[parentName], [parentName], analyzed);
		}
	});

	// we have completed the row, so proceed the rest
	return _analyzeRecursive(rest, maps as string[], analyzed);
}

/**
 * Build a directed graph from schema.  The nodes are the boxes.  There is an edge from box A into box B iff
 * box B sends data into A (i.e. box A follows **after** box B, the opposite way one would expect).
 *
 * @param schema Schema of the flow.
 * @private
 */
function analyzeSchema(schema: SerialSchemaComponent): DiGraph {
	const graph: DiGraph = new DiGraph();
	graph.addNode(ROOT_NODE);
	return _analyzeRecursive(schema, [ROOT_NODE], graph);
}

type FlowBoxesMetadata = {
	[index: string]: BoxMeta | BatchingBoxMeta;
};

/**
 *
 * @param boxNames names of the boxes in the flow
 * @param boxBMeta building metainformation collected while building the DAG
 * @param schema the definition of the schema, to identify "source" of the event
 */
//TODO: extract into EEmiter of the flow itself
// when emitting from stats EE, we can't distinguish events of various flows
function emitFlowSchema(
	boxNames: string[],
	graph: DiGraph,
	schema: FlowExplicitDescription
): void {
	const edges = graph.inEdges();
	const boxMetas: FlowBoxesMetadata = graph
		.nodes(true)
		.filter((n: NodeWithAttribs) => n[0] !== ROOT_NODE)
		.map((n: NodeWithAttribs) => {
			return {
				name: n[0],
				meta: (n[1].instance as BoxInterface | BatchingBoxInterface)
					.meta,
			};
		})
		.reduce(
			(metas, item) => {
				metas[item.name as string] = item.meta;
				return metas;
			},
			{} as FlowBoxesMetadata
		);

	eventEmitter.emit('flowSchema', schema, boxMetas, edges);
	return;
}

/**
 * Builder that connects the boxes into directed acyclic graph based on their dependences.
 * TODO: (idea2) use some logical/analytical language (SWI Prolog?), don't even figure the instantiation order of the
 * particular boxes (from the flow-outgoing queues) and their flow-incoming queues.
 */
export class DAGBuilder implements FlowBuilderI {
	public async build(
		schema: FlowExplicitDescription,
		componentFactory: ComponentFactoryI,
		drain?: PriorityQueueI<Message>
	): Promise<Flow> {
		// Directed graph of connected boxes.  Notice, that we are going to build the boxes from the end, i.e.
		// create the last box first, then a queue directing to it, then a box feeding the directing queue etc.
		//
		// Thus, the edges in the graph are oriented conversely, from the requiring box to the providing one.
		const graph: DiGraph = analyzeSchema(schema['process']);
		// storage of metadata to box.
		// instance: box instance -- we need to reference it when instantiating flow-incoming queue into the box.
		// outputs: array of flow-outgoing queues from the box.

		// See https://en.wikipedia.org/wiki/Topological_sorting
		//
		// As we have the graph oriented conversely (see comments above), we get array of box names sorted in such a way
		// that for a particular box `A` all the boxes requiring A are listed before the `A` itself.
		const boxBuildOrder: string[] = topologicalSort(graph) as string[];
		// Now, go through the boxes and
		// 1. instantiate the box (as all its flow-dependents are already instantiated, inlcuding their queues, we have all the information)
		// 2. instantiate all the flow-incoming queues (i.e. where the messages will come into this box)
		const rootQ = await boxBuildOrder.reduce(
			/**
			 * @param prevBoxReady -- the outgoing queue of the last instantiated box
			 * It has no sense until the last box is `_root_`.  Then it is a desired
			 * input queue into the whole DAG.
			 * @param boxName -- we are going to bring this box to life
			 */
			async (
				prevBoxReady: Promise<PriorityQueueI<Message>>,
				boxName: string
			): Promise<PriorityQueueI<Message>> => {
				// we must be sure all the output edges are stored in the boxMeta for the box/node being currently processed.
				// This is done *after* the box instantiation (asynchronous), so we will wait until the previous step
				// has completed successfully.
				await prevBoxReady;
				let returnValue: PriorityQueueI<Message>;

				// All my dependencies are done, as well as the queues feeding them.
				// Or I am a terminal box without dependencies
				const depsQueues: PriorityQueueI<Message>[] = graph
					.inEdges(boxName, true)
					.map((edgeInfo: EdgeWithAttribs) => edgeInfo[2].queue);

				// we are at the root element.  This is the input into the graph.
				if (boxName === ROOT_NODE) {
					emitFlowSchema(boxBuildOrder, graph, schema);
					if (depsQueues.length == 1) {
						return depsQueues[0];
					} else {
						return new Tee(...depsQueues);
					}
				}

				const myParams: any = schema.parameters
					? ((schema.parameters as any)[boxName] as any)
					: undefined;
				if (depsQueues.length == 0) {
					// no queues from me, no dependencies => I am a terminal box
					// output goes into drain
					graph.addNode(boxName, {
						instance: await componentFactory.create(
							boxName,
							drain,
							myParams
						),
					});
					returnValue = noopQueue;
				} else if (depsQueues.length == 1) {
					// I have a single dependency, so set it to be the output queue
					graph.addNode(boxName, {
						instance: await componentFactory.create(
							boxName,
							(returnValue = depsQueues[0]),
							myParams
						),
					});
				} else {
					// I have more dependencies.  Create a Tee -- single queue that
					// splits into more, and let the Tee be the output
					graph.addNode(boxName, {
						instance: await componentFactory.create(
							boxName,
							(returnValue = new Tee(...depsQueues)),
							myParams
						),
					});
				}

				// The box is instantiated, let's instantiate feeding queues
				// notice that boxMeta[boxName].instance is populated in the if -- else above
				const instance = (graph.node.get(boxName) as any).instance;
				assert(instance !== undefined);

				const selfSingle: BoxInterface = instance as BoxInterface;
				const selfBatch: BatchingBoxInterface = instance as BatchingBoxInterface;
				const joinedQ = selfBatch.meta.batch
					? new MemoryPriorityBatchQueue(
							(msgs: Message[]) => selfBatch.process(msgs),
							{
								concurrency: selfBatch.meta.concurrency || 1,
								batch: {
									size: selfBatch.meta.batch.maxSize,
									waitms:
										(selfBatch.meta.batch.timeoutSeconds ||
											DEFAULT_BATCH_TIMEOUT_SEC) * 1000,
								},
							},
							boxName
					  )
					: new MemoryPrioritySingleQueue(
							(msg: Message) => selfSingle.process(msg),
							{
								concurrency: selfSingle.meta.concurrency || 1,
							},
							boxName
					  );
				graph.addNode(boxName, {input: joinedQ});

				// Select the edges (queues) from the graph
				// and prepare the same number of of queues joining into `joinedQ`
				const inputs: Edge[] = graph.outEdges(boxName);
				const inputQs: PriorityQueueI<Message>[] =
					inputs.length === 1
						? [joinedQ]
						: new QZip(joinedQ, inputs.length).inputs;

				// Store the queues in metadata storage by boxes I am dependent of
				inputs.forEach((inEdge: Edge, index: number) => {
					// Edge == [from (i.e. me), parent]
					const providingBox: string = inEdge[1] as string;
					const inputQ = inputQs[index];
					inputQ.source = providingBox;
					graph.addEdge(boxName, providingBox, {queue: inputQ});
				});
				return returnValue;
			},
			Promise.resolve(noopQueue)
		);

		graph.addNode(ROOT_NODE, {input: rootQ});
		return new Flow(rootQ, graph);
	}
}
