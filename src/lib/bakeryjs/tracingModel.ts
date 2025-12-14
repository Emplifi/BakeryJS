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

import type { AttributeDict, Edge } from 'sb-jsnetworkx'
import { DiGraph } from 'sb-jsnetworkx'
import { ROOT_NODE } from './builders/DAGBuilder/builder'
import { everyMap } from './eval/every'

/**
 * Helper class.  Throughout this code, the maps of maps are used extensively
 * with chained `.get(..).get(..)`.  This subclass takes care of `undefined`
 * in the middle of the chain.
 */
class DefinedMap<K, V> extends Map<K, V> {
	public get(key: K): V {
		const value = super.get(key)
		if (value === undefined) {
			throw new TypeError(`Requested key ${key} is missing`)
		} else {
			return value
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
	boxes: DefinedMap<string, boolean>
	done: boolean
}

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
type MsgStore = DefinedMap<string, DefinedMap<string[], DefinedMap<string, MsgTrace>>>

/**
 * Dimension node type
 *
 * @property complete - have all children been generated? Derived from Sentinel Message.
 * @property done - Am I already done?
 * @property superParentMsgId - Id of parent message of my own parent message.  Needed for
 *           recursive check of `done` state of the parent structure.
 */
type DimensionTrace = {
	complete: boolean
	done: boolean
	superParentMsgId: string
}

/**
 * Storage of dimension nodes of the Tracing Structure in the relational way
 *
 * Dimension Dim1 populated from message with msgId is stored as:
 *    msgId -> Dim1 -> DimensionTrace
 *
 * Dimension is represented as string[], e.g. [Dim1, Dim11].
 */
type DimensionStore = DefinedMap<string, DefinedMap<string[], DimensionTrace>>

/**
 * The Tracing Structure (see module doc for explanation)
 */
export class TracingModel {
	/**
	 * The Flow structure (with edges reversed, i.e. pointing upwards)
	 */
	private readonly boxGraph: DiGraph
	/**
	 * The Dimensions structure
	 */
	private readonly dimGraph: DiGraph
	/**
	 * The callback invoked when job is `done`
	 */
	private readonly jobDone: (msgId: string) => void
	/**
	 * The storage for nodes of the tracing structure.
	 */
	protected msgStore: MsgStore
	protected dimensionStore: DimensionStore

	public constructor(boxGraph: DiGraph, dimGraph: DiGraph, jobDoneCbk: (msgId: string) => void) {
		this.boxGraph = boxGraph
		this.dimGraph = dimGraph
		this.jobDone = jobDoneCbk

		/** Create the entry for root dimension*/
		const rootDimension = (this.boxGraph.node.get(ROOT_NODE) as AttributeDict).dimension
		this.msgStore = new DefinedMap([['-', new DefinedMap([[rootDimension, new DefinedMap()]])]])
		this.dimensionStore = new DefinedMap([
			[
				'-',
				new DefinedMap([[rootDimension, { complete: false, done: false, superParentMsgId: '' }]])
			]
		])
	}

	// ================== Helper methods for nested map access ==================

	/**
	 * Gets the message trace for a specific message in a dimension.
	 */
	private getMessageTrace(parentMsgId: string, dimension: string[], msgId: string): MsgTrace {
		return this.msgStore.get(parentMsgId).get(dimension).get(msgId)
	}

	/**
	 * Gets the dimension messages map for a parent message and dimension.
	 */
	private getDimensionMessages(
		parentMsgId: string,
		dimension: string[]
	): DefinedMap<string, MsgTrace> {
		return this.msgStore.get(parentMsgId).get(dimension)
	}

	/**
	 * Checks if a message exists in the given dimension.
	 */
	private hasMessage(parentMsgId: string, dimension: string[], msgId: string): boolean {
		return this.msgStore.get(parentMsgId).get(dimension).has(msgId)
	}

	/**
	 * Checks if a dimension exists for a parent message.
	 */
	private hasDimension(parentMsgId: string, dimension: string[]): boolean {
		return this.msgStore.get(parentMsgId).has(dimension)
	}

	/**
	 * Gets the dimension trace for a parent message and dimension.
	 */
	private getDimensionTrace(parentMsgId: string, dimension: string[]): DimensionTrace {
		return this.dimensionStore.get(parentMsgId).get(dimension)
	}

	/**
	 * Checks if dimension tracking exists for a parent message.
	 */
	private hasDimensionTracking(parentMsgId: string): boolean {
		return this.dimensionStore.has(parentMsgId)
	}

	/**
	 * Checks if a specific dimension is tracked for a parent message.
	 */
	private isDimensionTracked(parentMsgId: string, dimension: string[]): boolean {
		return (
			this.dimensionStore.has(parentMsgId) && this.dimensionStore.get(parentMsgId).has(dimension)
		)
	}

	/**
	 * Gets the box dimension from the box graph.
	 */
	private getBoxDimension(boxName: string): string[] {
		return (this.boxGraph.node.get(boxName) as AttributeDict).dimension
	}

	/**
	 * Gets the boxes that belong to a dimension.
	 */
	private getDimensionBoxes(dimension: string[]): string[] {
		return (this.dimGraph.node.get(dimension) as AttributeDict).boxes
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
		const dimension = this.getBoxDimension(boxName)

		if (this.hasMessage(parentMsgId, dimension, msgId)) {
			this.markBoxAsPassed(parentMsgId, dimension, msgId, boxName)
		} else {
			this.insertNewMsg(dimension, boxName, parentMsgId, msgId)
		}

		// Check the completion after each new information
		// TODO: Defer checking after all the messages of the batch have been added
		this.checkMsgFinishState(msgId, parentMsgId, dimension)
	}

	/**
	 * Marks a box as passed for an existing message trace.
	 */
	private markBoxAsPassed(
		parentMsgId: string,
		dimension: string[],
		msgId: string,
		boxName: string
	): void {
		this.getMessageTrace(parentMsgId, dimension, msgId).boxes.set(boxName, true)
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
		const dimension = this.getBoxDimension(boxName)

		// The dimension can be already deleted, if the child messages have completed
		// the flow through the dimension before (remind, all is asynchronous).
		if (!this.isDimensionTracked(parentMsgId, dimension)) {
			return
		}

		this.getDimensionTrace(parentMsgId, dimension).complete = true
		this.checkDimensionFinishState(parentMsgId, dimension)
	}

	private insertNewMsg(
		dimension: string[],
		boxName: string,
		parentMsgId: string,
		msgId: string
	): void {
		const boxFulfilled = this.createBoxFulfilledMap(dimension, boxName)
		this.getDimensionMessages(parentMsgId, dimension).set(msgId, {
			boxes: boxFulfilled,
			done: false
		} as MsgTrace)

		this.initializeSubDimensions(dimension, parentMsgId, msgId)
	}

	/**
	 * Creates a map of boxes with their fulfilled status for a new message.
	 */
	private createBoxFulfilledMap(
		dimension: string[],
		currentBox: string
	): DefinedMap<string, boolean> {
		const boxesToPass = this.getDimensionBoxes(dimension)
		const boxFulfilled = new DefinedMap<string, boolean>()
		for (const b of boxesToPass) {
			boxFulfilled.set(b, b === currentBox)
		}
		return boxFulfilled
	}

	/**
	 * Initializes sub-dimension tracking for a new message if sub-dimensions exist.
	 */
	private initializeSubDimensions(dimension: string[], parentMsgId: string, msgId: string): void {
		const subDimensions = this.getSubDimensions(dimension)
		if (subDimensions.length === 0) {
			return
		}

		const mySubdims = new DefinedMap<string[], DimensionTrace>()
		this.msgStore.set(msgId, new DefinedMap<string[], DefinedMap<string, MsgTrace>>())

		for (const subDim of subDimensions) {
			this.initializeSingleSubDimension(subDim, parentMsgId, msgId, mySubdims)
		}

		this.dimensionStore.set(msgId, mySubdims)
	}

	/**
	 * Initializes a single sub-dimension for tracking.
	 */
	private initializeSingleSubDimension(
		subDim: string[],
		parentMsgId: string,
		msgId: string,
		subDimMap: DefinedMap<string[], DimensionTrace>
	): void {
		subDimMap.set(subDim, {
			complete: false,
			done: false,
			superParentMsgId: parentMsgId
		} as DimensionTrace)
		this.msgStore.get(msgId).set(subDim, new DefinedMap())
	}

	/**
	 * Gets the sub-dimensions of a given dimension.
	 */
	private getSubDimensions(dimension: string[]): string[][] {
		return this.dimGraph
			.inEdges(dimension)
			.map((e: Edge) => e[0] as string[])
			.filter((subDim): subDim is string[] => subDim !== undefined)
	}

	private checkMsgFinishState(msgId: string, parentMsgId: string, dimension: string[]): void {
		if (!this.isMessageComplete(msgId, parentMsgId, dimension)) {
			return
		}

		this.markMessageComplete(msgId, parentMsgId, dimension)
		this.propagateCompletion(msgId, parentMsgId, dimension)
	}

	/**
	 * Checks if a message has completed all its boxes and sub-dimensions.
	 */
	private isMessageComplete(msgId: string, parentMsgId: string, dimension: string[]): boolean {
		const boxesDone = this.getBoxesDone(msgId, parentMsgId, dimension)
		if (!boxesDone) {
			return false
		}

		return this.getSubDimensionsDone(msgId)
	}

	/**
	 * Marks a message as complete and cleans up its tracking data.
	 */
	private markMessageComplete(msgId: string, parentMsgId: string, dimension: string[]): void {
		if (process.env.BAKERYJS_DISABLE_EXPERIMENTAL_TRACING) {
			this.getMessageTrace(parentMsgId, dimension, msgId).done = true
		} else {
			this.getDimensionMessages(parentMsgId, dimension).delete(msgId)
		}
		this.dimensionStore.delete(msgId)
	}

	/**
	 * Propagates completion to parent dimension or finishes the job.
	 */
	private propagateCompletion(msgId: string, parentMsgId: string, dimension: string[]): void {
		if (this.isRootDimension(dimension)) {
			this.finishRootJob(msgId, parentMsgId, dimension)
			return
		}

		this.checkDimensionFinishState(parentMsgId, dimension)
	}

	/**
	 * Checks if a dimension is the root dimension.
	 */
	private isRootDimension(dimension: string[]): boolean {
		return dimension.length === 0
	}

	/**
	 * Finishes a root job and invokes the completion callback.
	 */
	private finishRootJob(msgId: string, parentMsgId: string, dimension: string[]): void {
		this.getDimensionMessages(parentMsgId, dimension).delete(msgId)
		this.jobDone(msgId)
	}

	private checkDimensionFinishState(parentMsgId: string, dimension: string[]): void {
		// The dimension may even have not started yet
		if (!this.hasDimension(parentMsgId, dimension)) {
			return
		}

		if (!this.getDimensionDone(parentMsgId, dimension)) {
			return
		}

		this.markDimensionComplete(parentMsgId, dimension)
		this.propagateDimensionCompletion(parentMsgId, dimension)
	}

	/**
	 * Marks a dimension as complete and cleans up child messages.
	 */
	private markDimensionComplete(parentMsgId: string, dimension: string[]): void {
		this.getDimensionTrace(parentMsgId, dimension).done = true
		this.msgStore.get(parentMsgId).delete(dimension)
	}

	/**
	 * Propagates dimension completion to the parent message.
	 */
	private propagateDimensionCompletion(parentMsgId: string, dimension: string[]): void {
		const parentDimension = this.getParentDimension(dimension)
		if (!parentDimension) {
			return
		}

		const superParentMsgId = this.getDimensionTrace(parentMsgId, dimension).superParentMsgId
		this.checkMsgFinishState(parentMsgId, superParentMsgId, parentDimension)
	}

	/**
	 * Gets the parent dimension from the dimension graph.
	 */
	private getParentDimension(dimension: string[]): string[] | null {
		const outEdges = this.dimGraph.outEdges(dimension)
		const firstEdge = outEdges[0]
		if (!firstEdge) {
			return null
		}
		return firstEdge[1] as string[]
	}

	private getSubDimensionsDone(msgId: string): boolean {
		if (!this.hasDimensionTracking(msgId)) {
			return true
		}

		return everyMap(this.dimensionStore.get(msgId), (dt: DimensionTrace) => dt.complete && dt.done)
	}

	private getDimensionDone(parentMsgId: string, dimension: string[]): boolean {
		if (!this.getDimensionTrace(parentMsgId, dimension).complete) {
			return false
		}

		return everyMap(this.getDimensionMessages(parentMsgId, dimension), (mT: MsgTrace) => mT.done)
	}

	private getBoxesDone(msgId: string, parentMsgId: string, dimension: string[]): boolean {
		return everyMap(this.getMessageTrace(parentMsgId, dimension, msgId).boxes, Boolean)
	}
}
