import {PriorityQueueI} from './queue/PriorityQueueI';
import {Job} from './Job';
import {DataMessage, Message} from './Message';
import {FlowExplicitDescription} from './FlowBuilderI';
import {AttributeDict, DiGraph, Node, topologicalSort} from 'jsnetworkx';
import {EventEmitter} from 'events';
import {ROOT_NODE} from './builders/DAGBuilder/builder';
import {BatchingBoxMeta, BoxMeta} from './BoxI';
import {deepStrictEqual} from 'assert';
import {TracingModel} from './tracingModel';
import {MsgEvent} from './BoxEvents';

/**
 * We have Boxes set up properly, now we have to interconnect them to the workflow.
 * There will be probably more interpretations of the workflow network.  Currently,
 * we have these two in mind:
 *
 * 1. Parallel/Serial waterfall of commands, e.g.
 *   a. Take a Job and push it into Box A.
 *   b. the messages from A push into boxes B and C -- each processes the Messagese independently on the other.
 *      The contributions of the both Boxes to single Message is merged again into the single respective Message.
 *   c. Once both B and C are ready, take the Messages and push it into other Boxes D, E, F.
 *   d. The flow  of merged Messages out of D, E, F is a result and is passed into output of the flow.
 *
 * 2. Assembly lines in a factory, e.g.
 *   a. Take a Job and push it into Box A.
 *   b. Each message generated in A enteres Boxes B and C.
 *   c. The merged output of B and C enters D.  In the same time, the output from C enters E.
 *   d. Outputs from D and E enters F, moreover, output from D enters G.
 *   e. Flow of (merged) Messages from F and G is a result and is passed into output of the flow.
 *
 *   The flow must ensure that the input Job goes through all Boxes respecting dependencies.
 *
 * The Boxes (partially) ordered by its dependencies form generally a DAG (directed acyclic graph).
 * The Flow is the mechanism that lives on the edges of the DAG.  Its job is to move the Messages along the edges.
 * This is common to all various implementations of the Flow.
 *
 * The implementations may vary in the details, how the transfer of Messages is performed.
 * The edge can be an eager queue, that invokes the target Box as soon as possible since a Message has entered it.
 * Or the edge can be a "dispenser" that handles you a Message every time you ask for it.  Or the edge may have implemented
 * prioritization.
 *
 *  **The job of the Flow is: Given the Boxes and their settings, create the piping around them respecting their dependencies (requirements, provisions)
 * and the abilities (mapping, generation, aggregation).**
 *
 * TODO: (idea2) The flow has to track the (partial) order a Message is going through Boxes.  It will be needed for debugging
 *  the flows under development.  The mechanism for storage and report of these Trace -may be implemented in Message.- api available
 *  set up in Programm (used by the flow executor) --- e.g. opentracing/opentracing-javascript
 *
 * - ToDo: (idea2) The Flow must handle unhandled exceptions of the Boxes. Each flow on its own,
 *   or some common layer/wrapper/applicator?
 * - ToDo: (idea2) The Flow may have a finalization stage, that returns some aggregated document/statistics + flags (all Boxes OK, Box A error for 5% Messages)  of all the output messages?
 * - ToDo: (idea2) The Flow provides performance/monitoring metrics of the DAG edges.
 *
 * ## Events:
 * - process: (FlowExplicitDescription, Job)
 * - flowSchema: ({name: BoxMeta}[], Edge[])
 * - drain: ()
 */
export class Flow extends EventEmitter {
	private queue: PriorityQueueI<Message>;
	private graph: DiGraph;
	private dimensionGraph: DiGraph;
	private tracingModel: TracingModel;
	private jobPromises: Map<string, {resolve: Function; reject: Function}>;

	public constructor(queue: PriorityQueueI<Message>, graph: DiGraph) {
		super();
		this.queue = queue;
		this.graph = graph;
		this.dimensionGraph = this.analyzeDimensions(this.graph);
		this.jobPromises = new Map();

		this.tracingModel = new TracingModel(
			this.graph,
			this.dimensionGraph,
			(msgId: string) => {
				const promiseCallbacks = this.jobPromises.get(msgId);
				this.jobPromises.delete(msgId);
				if (promiseCallbacks) {
					promiseCallbacks.resolve();
				} else {
					throw new TypeError('Resolving callback not registered!');
				}
				this.emit('task_finish', msgId);
			}
		);

		// subscribe for the events from boxes
		for (const boxWithAttribs of this.graph.nodesIter(true)) {
			if (boxWithAttribs[0] === ROOT_NODE) {
				continue;
			}
			const boxAttribs: AttributeDict = boxWithAttribs[1];
			boxAttribs.instance.on('msg_finished', (msgInfos: MsgEvent[]) =>
				// TODO: Defer checking after all the messages of the batch have been added
				msgInfos.forEach((msgInfo) =>
					this.tracingModel.addMsg(
						msgInfo.messageId,
						msgInfo.parentMsgId || '-',
						msgInfo.boxName
					)
				)
			);
			// if the instance is the generator, subscribe for `generation_finished`
			boxAttribs.instance.on(
				'generation_finished',
				(msgInfos: MsgEvent[]) =>
					msgInfos.forEach((msgInfo) =>
						this.tracingModel.setDimensionComplete(
							msgInfo.messageId || '-',
							msgInfo.boxName
						)
					)
			);
		}
	}

	public process(job: Job): Promise<void> {
		const message = new DataMessage(job);
		this.queue.push(message, 1);
		return new Promise((resolve, reject) => {
			this.jobPromises.set(message.id, {resolve, reject});
			// in case of degenerated jobs (usually the testing ones), the call `addMsg`
			// can synchronously mark the job as fulfilled and invoke the `resolve`.
			// For that cases, the invocation of `addMsg` must be *after* having stored
			// `resolve`/`reject` into `jobPromises`.
			this.tracingModel.addMsg(message.id, '-', ROOT_NODE);
		});
	}

	public async destroy(): Promise<any> {}

	/**
	 * Analyzes/modifies flow graph and extracts the dimensions structure. It adds
	 * the nodes attribute 'dimension'.
	 *
	 * The structure describes the (partial) order the completion of the particular
	 * dimensions has to occur. The structure is *a tree*, where the root is an empty
	 * dimension (the top level). Other dimensions are the nodes with and edge oriented
	 * from the child to the parent one.  Each dimension holds a list of boxes belonging to it
	 * in dimension's attribute.
	 *
	 * During analysis of the dimensions, it can uncover a dimension mismatch.  By a mismatch
	 * we mean such a flow graph that the dimensions cannot be ordered into a tree and
	 * DAG would be required.  Such a flow is invalid and a proper exception is thrown.
	 *
	 * @param graph - nodes: string (boxName), attributes: instance: BoxInstance
	 *                edges oriented from depending boxes to the providing box
	 * @returns - graph: nodes: string[] (dimensions), attributes: boxes: string[], box names
	 */
	private analyzeDimensions(graph: DiGraph): DiGraph {
		const dimGraph: DiGraph = new DiGraph();
		dimGraph.addNode([], {boxes: [ROOT_NODE]});

		// root node has top dimension
		graph.addNode(ROOT_NODE, {dimension: []});
		// let's go through nodes from root into leaves in topological order
		// Remind the opposite direction of the edges, so let's reverse it to
		// proceed from top to down.
		const boxTopoOrder = topologicalSort(graph).reverse();
		// Don't analyze root node
		boxTopoOrder.slice(1).forEach((boxName) => {
			const parentNode: Node = graph.outEdges(boxName)[0][1];
			const parentDimension: Node[] = (graph.node.get(
				parentNode
			) as AttributeDict).dimension;
			const myMeta: BoxMeta | BatchingBoxMeta = (graph.node.get(
				boxName
			) as AttributeDict).instance.meta;
			let myDimension: Node[];
			if (
				(myMeta as BoxMeta).emits &&
				(myMeta as BoxMeta).emits.length > 0
			) {
				// I am a generator
				myDimension = parentDimension.concat((myMeta as BoxMeta).emits);
			} else if (!myMeta.aggregates) {
				// I am a mapper
				myDimension = parentDimension;
			} else {
				// I am an aggregator
				myDimension = parentDimension.slice(0, -1);
			}

			if (!dimGraph.hasNode(myDimension)) {
				dimGraph.addNode(myDimension, {boxes: []});
				dimGraph.addEdge(myDimension, parentDimension);
			}

			if ((graph.node.get(boxName) as AttributeDict).dimension) {
				// test of graph validity
				deepStrictEqual(
					(graph.node.get(boxName) as AttributeDict).dimension,
					myDimension,
					`Dimensions mismatch. The flow data dimensions are inconsistent in box ${boxName}`
				);
			} else {
				graph.addNode(boxName, {dimension: myDimension});
				// the node `childDimension` has been inserted above
				(dimGraph.node.get(myDimension) as AttributeDict).boxes.push(
					boxName
				);
			}
		});

		return dimGraph;
	}
}

type FlowIdDesc = {
	flow: string;
};

// TODO: generate this from type FlowIdDesc
export const FlowIdDescValidation = {
	type: 'object',
	$id: 'bakeryjs/flow',
	title: 'Flow defined by its id',
	required: ['flow'],
	properties: {
		flow: {
			description: 'Identifier of the flow in the flow catalog.',
			type: 'string',
			minLength: 1,
		},
	},
};

export type FlowDescription = FlowExplicitDescription | FlowIdDesc;
export function hasFlow(desc: FlowDescription): desc is FlowIdDesc {
	return (desc as FlowIdDesc).flow !== undefined;
}
export function hasProcess(
	desc: FlowDescription
): desc is FlowExplicitDescription {
	return (desc as FlowExplicitDescription).process !== undefined;
}
