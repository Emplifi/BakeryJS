/**
 * This module traces the job as it passes through boxes.
 *
 * ## Principle
 *
 * The boxes form a directed acyclic graph with the top node -- the ROOT_NODE.
 * The Message virtually enters the graph in the ROOT_NODE.
 *
 * When two (or more) edges connects the box with its dependants, the Message is
 * virtually duplicated and enters those dependants concurrently.
 *
 * When a box is *a generator*, several messages leave the box (children of the
 * original message), but not the original one.  The children generated from the
 * incoming Message form so called *Dimension* (this is the dimension declared
 * in the generator's metadata `emits`).
 *
 * Every consistent flow has the property that each box processes only messages
 * of one particular dimension, neither more nor less.  Thus, we can assign a
 * dimension to each box.  Moreover, the dimensions can be ordered into a *Tree*
 * where the edge denotes the dependency of one dimension on the other.
 *
 * Finally, the *job is done on its dimension* iff
 * 1. The job has passed all boxes of its dimension
 * 2. For every subDimension of the dimension:
 *   a. All children of job have been generated into subDimension
 *   b. Every child is done on its subDimensions.
 *
 * ## Data Structures
 *
 * The definition is recursive with respect to dimensions being organized into
 * the *Tree* which reflects in the recursive data structures.
 * (The chart has been generated on http://asciiflow.com)
 *
 *         Flow           Dimension Graph                    Tracing Structure
 *
 *      +---------+        +---->[]<-----+                      +--------+
 *      |ROOT_NODE|        |             |              +-------+ Job@[] +--------------+
 *      +----+----+        +             +              |       +--------+              |
 *           |           Dim1<---+     Dim2             |                               |
 *          +v+                  |                   +--+-+                            ++---+
 *     +----+A+----+             +               +---+Dim1+----+                  +----+Dim2+-------+
 *     |    +++    |           Dim11             |   +----+    |                  |    +----+       |
 *     |     |     |                             |             |                  |                 |
 *  +--v-+   |  +--v-+                           |             |                  |                 |
 *  |Gen1|   |  |Gen2|                      +----+----+  +-----+---+          +---+-----+      +----+----+
 *  +-+--+   |  +--+-+                   +--+msg1@Dim1|  |msg2@Dim1+----+     |msg4@Dim2|      |msg5@Dim2|
 *    |      |     |                     |  +---------+  +---------+    |     +---------+      +---------+
 *   +v+     |    +v+                    |                              |
 *   |B|     |    |C|                    |                              |
 *   +++     |    +++                    |                              |
 *    |      |     |                     |                              |
 *    |      |     |                  +--+--+                        +--+--+
 * +--v--+   |  +--v-+           +----+Dim11+------+            +----+Dim11+------+
 * |Gen11|   +--+Agg2|           |    +-----+      |            |    +-----+      |
 * +--+--+   |  +-+--+           |                 |            |                 |
 *    |      |    |        +-----+----+      +-----+----+ +-----+----+      +-----+----+
 *   +v+    +v+  +v+       |msg7@Dim11|      |msg8@Dim11| |msgA@Dim11|      |msgB@Dim11|
 *   |D|    |E|  |F|       +----------+      +----------+ +----------+      +----------+
 *   +-+    +-+  +-+
 *
 * ### The Flow
 *
 * - boxes Gen1, Gen2, Gen11 are *generators* emitting dimensions Dim1, Dim2 and Dim11.
 * - box Agg2 is *aggregator* aggregating dimension Dim2 back to root (empty) dimension.
 * - correspondence of boxes and dimensions:
 *   - root dimensions: ROOT_NODE, A, Agg2, E, F
 *   - Dim1: Gen1, B
 *   - Dim2: Gen2, C
 *   - Dim11: Gen11, D
 *
 * ### The Dimension Graph
 *
 * Describes that dimensions Dim1 and Dim2 are generated from the root dimension
 * and that Dim11 is generated from Dim1.
 *
 * ### Tracing Structure (captured in a moment where all the messages are generated and noone *done*)
 *
 * The Job (the root message) is a stem for two sets of children: generated in Dim1 and Dim2.
 * Each dimension node (Dim1, Dim2 and both Dim11s) holds information about
 *  1. whether all children have been generated and placed into the structure (attribute complete)
 *  2. whether all the children are *done* (attribute done)
 *  3. super parent message node -- for node Dim11 it is node `Job@[]`.  Dim1 and Dim2 have artificial node `-`.
 *
 * Each message node keeps information about
 *  1. boxes the message has to pass through and a flag whether it did (attribute boxes)
 *  2. whether it has passed through all the boxes and all its child dimension nodes
 *     are done (attribute done)
 *
 * Every time a message passes through a box, the box is marked as passed in the respective message node.  Then,
 * the node is checked for `done` -- i.e. whether all boxes are passed and all child dimensions are done.
 * If true, the node is marked as `done`, the child structures are deleted and the parent structure is checked.
 *
 * Check of the dimension node: check that all the children have already been generated. If true, check that all
 * the children messages are `done`.  If true, mark itself as `done` and delete the child structure.
 *
 * When root message checks that it is `done`, the callback is called and the rest of the structure is deleted.
 *
 * #### The events
 *
 * The flow subscribes to events `msg_finish` and `generation_finished` of the boxes providing information about message id and  parent message id.
 *
 * Remember, we can rely on the order of events only in the generating box.  Down the flow, the messages will shuffle due to asynchronous and parallel processing in boxes.
 * Thus, after every new information a check of `done` state must be done.
 */

import { AttributeDict, DiGraph, Edge } from 'sb-jsnetworkx';
import { ROOT_NODE } from './builders/DAGBuilder/builder';
import { everyMap } from './eval/every';

/**
 * Helper class.  Throughout this code, the maps of maps are used extensively
 * with chained `.get(..).get(..)`.  This subclass takes care of `undefined`
 * in the middle of the chain.
 */
class DefinedMap<K, V> extends Map<K, V> {
	public get(key: K): V {
		const value = super.get(key);
		if (value === undefined) {
			throw new TypeError(`Requested key ${key} is missing`);
		} else {
			return value;
		}
	}
}

/**
 * Message node type
 *
 * @property boxes - which boxes must the message pass through and did it already?
 * @property done - Am I already done?
 */
type MsgTrace = {
	boxes: DefinedMap<string, boolean>;
	done: boolean;
};

/**
 * Storage of message nodes of the Tracing Structure in the relational way
 *
 * Message msgId generated as part of dimension Dim1 with parent message parentMsgId
 * is stored as:
 *   parentMsgId -> Dim1 -> msgId -> MsgTrace
 *
 * Parent Id of the Job is the JobId and root (empty) dimension.
 * Dimension is represented as string[], e.g. [Dim1, Dim11].
 */
type MsgStore = DefinedMap<
	string,
	DefinedMap<string[], DefinedMap<string, MsgTrace>>
>;

/**
 * Dimension node type
 *
 * @property complete - have all children been generated? Derived from Sentinel Message.
 * @property done - Am I already done?
 * @property superParentMsgId - Id of parent message of my own parent message.  Needed for
 *           recursive check of `done` state of the parent structure.
 */
type DimensionTrace = {
	complete: boolean;
	done: boolean;
	superParentMsgId: string;
};

/**
 * Storage of dimension nodes of the Tracing Structure in the relational way
 *
 * Dimension Dim1 populated from message with msgId is stored as:
 *    msgId -> Dim1 -> DimensionTrace
 *
 * Dimension is represented as string[], e.g. [Dim1, Dim11].
 */
type DimensionStore = DefinedMap<string, DefinedMap<string[], DimensionTrace>>;

/**
 * The Tracing Structure (see module doc for explanation)
 */
export class TracingModel {
	/**
	 * The Flow structure (with edges reversed, i.e. pointing upwards)
	 */
	private readonly boxGraph: DiGraph;
	/**
	 * The Dimensions structure
	 */
	private readonly dimGraph: DiGraph;
	/**
	 * The callback invoked when job is `done`
	 */
	private readonly jobDone: (msgId: string) => void;
	/**
	 * The storage for nodes of the tracing structure.
	 */
	protected msgStore: MsgStore;
	protected dimensionStore: DimensionStore;

	public constructor(
		boxGraph: DiGraph,
		dimGraph: DiGraph,
		jobDoneCbk: (msgId: string) => void
	) {
		this.boxGraph = boxGraph;
		this.dimGraph = dimGraph;
		this.jobDone = jobDoneCbk;

		/** Create the entry for root dimension*/
		const rootDimension = (this.boxGraph.node.get(
			ROOT_NODE
		) as AttributeDict).dimension;
		this.msgStore = new DefinedMap([
			['-', new DefinedMap([[rootDimension, new DefinedMap()]])],
		]);
		this.dimensionStore = new DefinedMap([
			[
				'-',
				new DefinedMap([
					[
						rootDimension,
						{ complete: false, done: false, superParentMsgId: '' },
					],
				]),
			],
		]);
	}

	/**
	 * Process information that
	 *   message msgId with parent message parentMsgId has passed box boxname.
	 *
	 * @param msgId - id of the message
	 * @param parentMsgId - id of the parent of the message
	 * @param boxName - box the message has just passed through
	 */
	public addMsg(msgId: string, parentMsgId: string, boxName: string): void {
		const boxAttribs = this.boxGraph.node.get(boxName) as AttributeDict;
		const dimension = boxAttribs.dimension;

		if (
			//The message is already tracked (e.g. from upstream box of the same dimension)
			this.msgStore.get(parentMsgId).get(dimension).has(msgId)
		) {
			// mark the box as passed
			this.msgStore
				.get(parentMsgId)
				.get(dimension)
				.get(msgId)
				.boxes.set(boxName, true);
		} else this.insertNewMsg(dimension, boxName, parentMsgId, msgId);

		// Check the completion after each new information
		// TODO: Defer checking after all the messages of the batch have been added
		this.checkMsgFinishState(msgId, parentMsgId, dimension);
	}

	/**
	 * Process information that
	 *   all the children of message of parentMsgId have been generated.
	 *
	 * Note: The information arrives from the generator first, and then again
	 * from each downstream box of the same dimension.  Only the first one (from
	 * the generator) carries the information, the rest is redundant.
	 *
	 * Beware! One cannot conclude from this message on mapping box that all
	 * the children have passed the box **before**.  The order of messages in the flow
	 * **is not preserved!**
	 *
	 * @param parentMsgId - id of the parent message
	 * @param boxName - box the message has come from
	 */
	public setDimensionComplete(parentMsgId: string, boxName: string): void {
		const dimension = (this.boxGraph.node.get(boxName) as AttributeDict)
			.dimension;
		if (
			// The dimension can be already deleted, if the child messages have completed
			// the flow through the dimension before (remind, al is asynchronous).
			// The dimension could have been marked as complete by the Sentinel Message
			// from the generator box before.  Then, the parent job could have been
			// marked as complete and this dimension node have been deleted.
			this.dimensionStore.has(parentMsgId) &&
			this.dimensionStore.get(parentMsgId).has(dimension)
		) {
			this.dimensionStore.get(parentMsgId).get(dimension).complete = true;
			this.checkDimensionFinishState(parentMsgId, dimension);
		}
	}

	private insertNewMsg(
		dimension: string[],
		boxName: string,
		parentMsgId: string,
		msgId: string
	): void {
		{
			const boxesToPass = (this.dimGraph.node.get(
				dimension
			) as AttributeDict).boxes;
			const boxFulfilled = new DefinedMap<string, boolean>();
			for (const b of boxesToPass) {
				// the box the message has come from is already fulfilled
				boxFulfilled.set(b, b === boxName);
			}
			this.msgStore
				.get(parentMsgId)
				.get(dimension)
				.set(msgId, { boxes: boxFulfilled, done: false } as MsgTrace);

			const subDimensions = this.dimGraph
				.inEdges(dimension)
				.map((e: Edge) => e[0] as string[]);
			if (subDimensions.length > 0) {
				const mySubdims = new DefinedMap<string[], DimensionTrace>();
				// populate the message store with the new subDim space
				this.msgStore.set(
					msgId,
					new DefinedMap<string[], DefinedMap<string, MsgTrace>>()
				);

				for (let i = 0; i < subDimensions.length; i++) {
					const subDim = subDimensions[i];
					mySubdims.set(subDim, {
						complete: false,
						done: false,
						superParentMsgId: parentMsgId,
					} as DimensionTrace);
					this.msgStore.get(msgId).set(subDim, new DefinedMap());
				}

				this.dimensionStore.set(msgId, mySubdims);
			}
		}
	}

	private checkMsgFinishState(
		msgId: string,
		parentMsgId: string,
		dimension: string[]
	): void {
		const boxesDone = this.getBoxesDone(msgId, parentMsgId, dimension);

		if (!boxesDone) {
			return;
		}

		// check `done` state of the sub dimensions
		// if the message has no subdimension, consider this check fulfilled

		const subDimensionsDone = this.getSubDimensionsDone(msgId);

		if (!subDimensionsDone) {
			return;
		}

		if (process.env.BAKERYJS_DISABLE_EXPERIMENTAL_TRACING) {
			// All is checked.
			// Set the message as `done`
			this.msgStore
				.get(parentMsgId)
				.get(dimension)
				.get(msgId).done = true;
		} else {
			this.msgStore.get(parentMsgId).get(dimension).delete(msgId);
		}
		// Delete all child dimensions (they are done, either)
		this.dimensionStore.delete(msgId);

		// if we are checking the root job (ugly way of checking dimension is [])
		if (dimension.length === 0) {
			// delete the root job (it has no "parent" to handle it)
			this.msgStore.get(parentMsgId).get(dimension).delete(msgId);
			// call the done callback
			this.jobDone(msgId);
			return;
		}

		// if we are not in the root job, check also the parent dimension node
		this.checkDimensionFinishState(parentMsgId, dimension);
		return;
	}

	private checkDimensionFinishState(
		parentMsgId: string,
		dimension: string[]
	): void {
		// The dimension may even have not started yet! The first message of the dimension
		// can be still in its 1st box.
		if (!this.msgStore.get(parentMsgId).has(dimension)) {
			return;
		}

		const dimensionDone = this.getDimensionDone(parentMsgId, dimension);

		if (!dimensionDone) {
			return;
		}

		this.dimensionStore.get(parentMsgId).get(dimension).done = true;
		// delete child messages (they are `done`, either)
		this.msgStore.get(parentMsgId).delete(dimension);

		// I wan't to check my parent message for completeness. However,
		// I don't have its key in the store (superParent, parentDim, parentMsgId).
		// Instead, check the completeness of my parent dimension.
		const parentDimension = this.dimGraph.outEdges(
			dimension
		)[0][1] as string[];
		const superParentMsgId = this.dimensionStore
			.get(parentMsgId)
			.get(dimension).superParentMsgId;
		this.checkMsgFinishState(
			parentMsgId,
			superParentMsgId,
			parentDimension
		);
		return;
	}

	private getSubDimensionsDone(msgId: string) {
		if (!this.dimensionStore.has(msgId)) return true;

		return everyMap(
			this.dimensionStore.get(msgId),
			(dt: DimensionTrace) => dt.complete && dt.done
		);
	}

	private getDimensionDone(parentMsgId: string, dimension: string[]) {
		if (!this.dimensionStore.get(parentMsgId).get(dimension).complete) {
			return false;
		}

		return everyMap(
			this.msgStore.get(parentMsgId).get(dimension),
			(mT: MsgTrace) => mT.done
		);
	}

	private getBoxesDone(
		msgId: string,
		parentMsgId: string,
		dimension: string[]
	) {
		return everyMap(
			this.msgStore.get(parentMsgId).get(dimension).get(msgId).boxes,
			Boolean
		);
	}
}
