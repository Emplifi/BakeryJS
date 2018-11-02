import FlowBuilderI, {
	ConcurrentSchemaComponent,
	FlowExplicitDescription,
	SchemaComponent,
	SchemaObject,
	SerialSchemaComponent,
} from '../FlowBuilderI';
import {BatchingBoxInterface, BoxInterface} from '../BoxI';
import ComponentFactoryI from '../ComponentFactoryI';
import {PriorityQueueI} from '../queue/PriorityQueueI';
import {Message} from '../Message';
import {MemoryPrioritySingleQueue} from '../queue/MemoryPriorityQueue';
import {AssertionError} from 'assert';
import {Flow} from '../Flow';
import {DiGraph, Edge} from 'jsnetworkx';

export const ROOT_NODE = '_root_';

type ProcessingCallback = (msg: Message) => Promise<void> | void;
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

export class MilanBuilder implements FlowBuilderI {
	public async build(
		schema: FlowExplicitDescription,
		componentFactory: ComponentFactoryI,
		drain?: PriorityQueueI<Message>
	): Promise<Flow> {
		const graph = analyzeSchema(schema.process);
		const rootQ = await this.buildPriorityQueue(
			{process: schema.process},
			'process',
			componentFactory,
			graph,
			drain
		);

		return new Flow(rootQ, graph);
	}

	private async createConcurrentFunction(
		componentFactory: ComponentFactoryI,
		name: string,
		graph: DiGraph,
		queue?: PriorityQueueI<Message>
	) {
		const component:
			| BoxInterface
			| BatchingBoxInterface = await componentFactory.create(name, queue);
		graph.addNode(name, {instance: component});
		const selfSingle: BoxInterface = component as BoxInterface;
		const selfBatch: BatchingBoxInterface = component as BatchingBoxInterface;

		if (selfBatch.meta.batch) {
			throw new AssertionError({
				message: "MilanBuilder can't use BatchingBox!",
			});
		}

		return (msg: Message) => selfSingle.process(msg);
	}

	private async buildConcurrentFunctions(
		concurrentSchema: ConcurrentSchemaComponent,
		componentFactory: ComponentFactoryI,
		graph: DiGraph,
		drain?: PriorityQueueI<Message>
	): Promise<ProcessingCallback[]> {
		const concurrentFunctions: ProcessingCallback[] = [];
		for (const boxName of concurrentSchema) {
			if (typeof boxName !== 'string') {
				for (const key of Object.keys(boxName)) {
					const queue = await this.buildPriorityQueue(
						boxName,
						key,
						componentFactory,
						graph,
						drain
					);
					concurrentFunctions.push(
						await this.createConcurrentFunction(
							componentFactory,
							key,
							graph,
							queue
						)
					);
				}
			} else {
				concurrentFunctions.push(
					await this.createConcurrentFunction(
						componentFactory,
						boxName,
						graph
					)
				);
			}
		}

		return concurrentFunctions;
	}

	private async buildSerialFunctions(
		serialSchema: SerialSchemaComponent,
		componentFactory: ComponentFactoryI,
		graph: DiGraph,
		drain?: PriorityQueueI<Message>
	): Promise<ProcessingCallback[]> {
		const serialFunctions: Promise<ProcessingCallback>[] = serialSchema.map(
			async (
				schema: ConcurrentSchemaComponent
			): Promise<ProcessingCallback> => {
				const concurrentFunctions: ProcessingCallback[] = await this.buildConcurrentFunctions(
					schema,
					componentFactory,
					graph,
					drain
				);
				return async (msg: Message): Promise<void> => {
					await Promise.all(
						concurrentFunctions.map(
							(processCbk: ProcessingCallback) => processCbk(msg)
						)
					);
				};
			}
		);

		return await Promise.all(serialFunctions);
	}

	private async buildPriorityQueue(
		schema: SchemaObject,
		key: string,
		componentFactory: ComponentFactoryI,
		graph: DiGraph,
		drain?: PriorityQueueI<Message>
	): Promise<PriorityQueueI<Message>> {
		const serialFunctions: ProcessingCallback[] = await this.buildSerialFunctions(
			schema[key],
			componentFactory,
			graph,
			drain
		);
		return new MemoryPrioritySingleQueue(
			async (task: Message): Promise<void> => {
				const appliedFcns = serialFunctions.reduce(
					(
						previous: Promise<Message>,
						serialCallback: ProcessingCallback
					): Promise<Message> => {
						return previous.then(
							async (msg: Message): Promise<Message> => {
								await serialCallback(msg);
								return msg;
							}
						);
					},
					Promise.resolve(task)
				);

				if (drain) {
					appliedFcns.then(
						(msg: Message): void => {
							drain.push(msg);
						}
					);
				}
			},
			{
				concurrency: 10,
			},
			ROOT_NODE
		);
	}
}
