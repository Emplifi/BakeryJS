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
 *
 * Each **dimension node** (Dim1, Dim2 and both Dim11s) holds information about:
 *  1. whether all children have been generated and placed into the structure (`complete`)
 *  2. whether all the children are *done* (`done`)
 *  3. super parent message node -- for node Dim11 it is node `Job@[]`. Dim1 and Dim2 have artificial node `-`.
 *  4. total count of children (`childCount`) and how many are done (`doneChildCount`) for O(1) completion check
 *
 * Each **message node** keeps information about:
 *  1. which boxes the message must pass through and which it has passed:
 *     - For dimensions with ≤32 boxes: uses bitfield tracking (`boxesPassed` and `boxesRequired`)
 *       where each bit represents a box. Completion check is O(1): `(passed & required) === required`
 *     - For dimensions with >32 boxes: falls back to Map<boxName, passed> tracking
 *  2. whether it has passed all boxes and all child dimension nodes are done (`done`)
 *
 * ### Algorithm
 *
 * Every time a message passes through a box, the box is marked as passed in the respective message node
 * (via bitwise OR for bitfield tracking, or Map.set for fallback). Then, the node is checked for `done`:
 *  - Box completion: O(1) bitwise AND comparison or O(n) Map iteration for fallback
 *  - Child dimension completion: O(1) counter comparison (`doneChildCount === childCount`)
 *
 * If all boxes passed and all child dimensions done, the node is marked as `done`, child structures
 * are deleted, and the parent structure is checked recursively.
 *
 * When root message checks that it is `done`, the callback is called and the rest of the structure is deleted.
 *
 * ### Performance Optimizations
 *
 * The following optimizations reduce CPU and memory overhead:
 *
 * 1. **Dimension Key Interning**: Dimension arrays (string[]) are converted to interned string keys
 *    (e.g., `["dim1", "dim2"]` → `"dim1/dim2"`) for O(1) hash-based Map lookups.
 *
 * 2. **Pre-computed Caches**: Box→dimension and dimension→boxes mappings are computed once at
 *    construction time, eliminating repeated graph traversals in hot paths.
 *
 * 3. **Bitfield Box Tracking**: For dimensions with ≤32 boxes, uses 32-bit integers instead of Maps.
 *    Each bit represents a box; completion is checked via bitwise AND in O(1).
 *
 * 4. **Completion Counters**: Dimension nodes track `childCount` and `doneChildCount`, enabling
 *    O(1) completion checks instead of O(n) iteration over all children.
 *
 * #### The events
 *
 * The flow subscribes to events `msg_finish` and `generation_finished` of the boxes
 * providing information about message id and parent message id.
 *
 * Remember, we can rely on the order of events only in the generating box. Down the flow,
 * the messages will shuffle due to asynchronous and parallel processing in boxes.
 * Thus, after every new information a check of `done` state must be done.
 */

import type { Edge } from 'sb-jsnetworkx'
import { DiGraph } from 'sb-jsnetworkx'
import { ROOT_NODE } from './builders/DAGBuilder/builder'
import { everyMap } from './eval/every'

/**
 * Debug mode flag - enables additional runtime checks for missing keys.
 * In production, these checks are skipped for performance.
 */
const DEBUG_MODE = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true'

/**
 * Maximum number of boxes that can be tracked with a single 32-bit bitfield.
 * Dimensions with more boxes will use the fallback Map-based tracking.
 */
const MAX_BITFIELD_BOXES = 32

/**
 * Message node type (Phase 2.1 optimized)
 *
 * Uses bitfield for box tracking when dimension has ≤32 boxes:
 * @property boxesPassed - Bitfield: bit N = 1 means box with index N has been passed
 * @property boxesRequired - Bitfield: all bits that must be set for completion
 *
 * Falls back to Map for dimensions with >32 boxes:
 * @property boxes - Map-based tracking (only used when boxesPassed/boxesRequired are -1)
 *
 * @property done - Am I already done?
 */
type MsgTrace = {
	// Bitfield tracking (used when dimension has ≤32 boxes)
	boxesPassed: number
	boxesRequired: number
	// Fallback Map tracking (used when dimension has >32 boxes, signaled by boxesPassed === -1)
	boxes: Map<string, boolean> | null
	done: boolean
}

/**
 * Storage of message nodes of the Tracing Structure in the relational way
 *
 * Message msgId generated as part of dimension Dim1 with parent message parentMsgId
 * is stored as:
 *   parentMsgId -> Dim1Key -> msgId -> MsgTrace
 *
 * Parent Id of the Job is the JobId and root (empty) dimension.
 * Dimension key is an interned string (e.g., "dim1/dim2") for O(1) hash-based lookup.
 */
type MsgStore = Map<string, Map<string, Map<string, MsgTrace>>>

/**
 * Dimension node type (Phase 2.2 optimized with counters)
 *
 * @property complete - have all children been generated? Derived from Sentinel Message.
 * @property done - Am I already done?
 * @property superParentMsgId - Id of parent message of my own parent message.  Needed for
 *           recursive check of `done` state of the parent structure.
 * @property childCount - total number of children in this dimension (set incrementally, final when complete=true)
 * @property doneChildCount - number of children that have completed (for O(1) completion check)
 */
type DimensionTrace = {
	complete: boolean
	done: boolean
	superParentMsgId: string
	childCount: number
	doneChildCount: number
}

/**
 * Storage of dimension nodes of the Tracing Structure in the relational way
 *
 * Dimension Dim1 populated from message with msgId is stored as:
 *    msgId -> Dim1Key -> DimensionTrace
 *
 * Dimension key is an interned string (e.g., "dim1/dim2") for O(1) hash-based lookup.
 */
type DimensionStore = Map<string, Map<string, DimensionTrace>>

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

	// ================== Phase 1 Optimization Caches ==================

	/**
	 * Cache: boxName -> dimension array reference (1.1)
	 * Pre-computed at construction time for O(1) lookup instead of graph access.
	 */
	private readonly boxDimensionCache: Map<string, string[]> = new Map()

	/**
	 * Cache: boxName -> interned dimension key (1.1 + 1.4)
	 * Pre-computed at construction time for O(1) lookup.
	 */
	private readonly boxDimensionKeyCache: Map<string, string> = new Map()

	/**
	 * Cache: interned dimension key -> boxes array (1.2)
	 * Pre-computed at construction time for O(1) lookup instead of graph access.
	 */
	private readonly dimensionBoxesCache: Map<string, string[]> = new Map()

	/**
	 * Cache: dimension array reference -> interned dimension key (1.4)
	 * Enables O(1) conversion from dimension arrays to interned string keys.
	 */
	private readonly dimensionToKeyCache: Map<string[], string> = new Map()

	/**
	 * Cache: interned dimension key -> dimension array reference (1.4)
	 * Reverse mapping for when we need the original dimension array.
	 */
	private readonly keyToDimensionCache: Map<string, string[]> = new Map()

	// ================== Phase 2 Optimization Caches ==================

	/**
	 * Cache: boxName -> bit index for bitfield tracking (2.1)
	 * Maps each box name to a unique bit position (0-31) within its dimension.
	 */
	private readonly boxBitIndexCache: Map<string, number> = new Map()

	/**
	 * Cache: interned dimension key -> required boxes bitmask (2.1)
	 * Pre-computed bitmask with all bits set for boxes in the dimension.
	 * Value of -1 indicates dimension has >32 boxes and uses Map fallback.
	 */
	private readonly dimensionRequiredMaskCache: Map<string, number> = new Map()

	/**
	 * Cache: interned dimension key -> whether to use bitfield (2.1)
	 * True if dimension has ≤32 boxes, false otherwise.
	 */
	private readonly dimensionUsesBitfieldCache: Map<string, boolean> = new Map()

	public constructor(boxGraph: DiGraph, dimGraph: DiGraph, jobDoneCbk: (msgId: string) => void) {
		this.boxGraph = boxGraph
		this.dimGraph = dimGraph
		this.jobDone = jobDoneCbk

		// Phase 1.1 + 1.4: Pre-populate box dimension caches
		this.initializeBoxDimensionCaches()

		// Phase 1.2 + 1.4: Pre-populate dimension boxes caches
		this.initializeDimensionBoxesCaches()

		// Phase 2.1: Pre-populate bitfield caches
		this.initializeBitfieldCaches()

		// Create the entry for root dimension using interned key
		const rootDimensionKey = this.boxDimensionKeyCache.get(ROOT_NODE) ?? ''
		this.msgStore = new Map([['-', new Map([[rootDimensionKey, new Map()]])]])
		this.dimensionStore = new Map([
			[
				'-',
				new Map([
					[
						rootDimensionKey,
						{ complete: false, done: false, superParentMsgId: '', childCount: 0, doneChildCount: 0 }
					]
				])
			]
		])
	}

	/**
	 * Initialize box dimension caches from the box graph.
	 */
	private initializeBoxDimensionCaches(): void {
		for (const nodeWithAttribs of this.boxGraph.nodes(true)) {
			const boxName = nodeWithAttribs[0] as string
			const dimension = nodeWithAttribs[1].dimension as string[]
			const dimensionKey = this.internDimensionArray(dimension)

			this.boxDimensionCache.set(boxName, dimension)
			this.boxDimensionKeyCache.set(boxName, dimensionKey)
		}
	}

	/**
	 * Initialize dimension boxes caches from the dimension graph.
	 */
	private initializeDimensionBoxesCaches(): void {
		for (const nodeWithAttribs of this.dimGraph.nodes(true)) {
			const dimension = nodeWithAttribs[0] as string[]
			const boxes = nodeWithAttribs[1].boxes as string[]
			const dimensionKey = this.internDimensionArray(dimension)

			this.dimensionBoxesCache.set(dimensionKey, boxes)
		}
	}

	/**
	 * Initialize bitfield caches for Phase 2.1 optimization.
	 * Maps each box to a bit index and pre-computes required masks for each dimension.
	 */
	private initializeBitfieldCaches(): void {
		// For each dimension, assign bit indices to boxes and compute required mask
		for (const [dimensionKey, boxes] of this.dimensionBoxesCache.entries()) {
			const boxCount = boxes.length
			const usesBitfield = boxCount <= MAX_BITFIELD_BOXES

			this.dimensionUsesBitfieldCache.set(dimensionKey, usesBitfield)

			if (usesBitfield) {
				let requiredMask = 0
				for (let i = 0; i < boxCount; i++) {
					const boxName = boxes[i] as string
					// Only set index if not already set (box may appear in multiple dimensions)
					if (!this.boxBitIndexCache.has(boxName)) {
						this.boxBitIndexCache.set(boxName, i)
					}
					requiredMask |= 1 << i
				}
				this.dimensionRequiredMaskCache.set(dimensionKey, requiredMask)
			} else {
				// Mark as fallback with -1
				this.dimensionRequiredMaskCache.set(dimensionKey, -1)
			}
		}
	}

	/**
	 * Check if a dimension uses bitfield tracking.
	 * Returns true for dimensions with ≤32 boxes, false otherwise.
	 */
	private usesBitfield(dimensionKey: string): boolean {
		return this.dimensionUsesBitfieldCache.get(dimensionKey) ?? false
	}

	/**
	 * Get the bit index for a box within its dimension.
	 */
	private getBoxBitIndex(boxName: string): number {
		return this.boxBitIndexCache.get(boxName) ?? 0
	}

	/**
	 * Get the required boxes bitmask for a dimension.
	 */
	private getDimensionRequiredMask(dimensionKey: string): number {
		return this.dimensionRequiredMaskCache.get(dimensionKey) ?? 0
	}

	/**
	 * Intern a dimension array, returning a cached string key.
	 * Creates new cache entries if the dimension is not yet interned.
	 */
	private internDimensionArray(dimension: string[]): string {
		// Check if already interned by reference
		let key = this.dimensionToKeyCache.get(dimension)
		if (key !== undefined) {
			return key
		}

		// Create new interned key
		key = dimension.join('/')
		this.dimensionToKeyCache.set(dimension, key)
		this.keyToDimensionCache.set(key, dimension)
		return key
	}

	/**
	 * Get the interned key for a dimension array.
	 * Uses cached reference lookup first, then falls back to value-based lookup.
	 */
	private getDimensionKey(dimension: string[]): string {
		// Fast path: exact reference match
		const cachedKey = this.dimensionToKeyCache.get(dimension)
		if (cachedKey !== undefined) {
			return cachedKey
		}

		// Slow path: compute key and cache for future reference lookups
		const key = dimension.join('/')
		this.dimensionToKeyCache.set(dimension, key)
		return key
	}

	// ================== Helper methods for nested map access ==================
	// All methods now use interned dimension keys (string) for O(1) hash-based lookup

	/**
	 * Safe map get with optional debug mode assertion.
	 * In production, returns value directly without undefined check.
	 */
	private safeGet<K, V>(map: Map<K, V>, key: K, context?: string): V {
		const value = map.get(key)
		if (DEBUG_MODE && value === undefined) {
			throw new TypeError(`Key ${key} missing${context ? ` in ${context}` : ''}`)
		}
		return value as V
	}

	/**
	 * Gets the message trace for a specific message in a dimension.
	 * @param dimensionKey - interned dimension key (string)
	 */
	private getMessageTrace(parentMsgId: string, dimensionKey: string, msgId: string): MsgTrace {
		const parentMap = this.safeGet(this.msgStore, parentMsgId, 'msgStore')
		const dimMap = this.safeGet(parentMap, dimensionKey, 'parentMap')
		return this.safeGet(dimMap, msgId, 'dimMap')
	}

	/**
	 * Gets the dimension messages map for a parent message and dimension.
	 * @param dimensionKey - interned dimension key (string)
	 */
	private getDimensionMessages(parentMsgId: string, dimensionKey: string): Map<string, MsgTrace> {
		const parentMap = this.safeGet(this.msgStore, parentMsgId, 'msgStore')
		return this.safeGet(parentMap, dimensionKey, 'parentMap')
	}

	/**
	 * Checks if a message exists in the given dimension.
	 * @param dimensionKey - interned dimension key (string)
	 */
	private hasMessage(parentMsgId: string, dimensionKey: string, msgId: string): boolean {
		const parentMap = this.msgStore.get(parentMsgId)
		if (!parentMap) return false
		const dimMap = parentMap.get(dimensionKey)
		if (!dimMap) return false
		return dimMap.has(msgId)
	}

	/**
	 * Checks if a dimension exists for a parent message.
	 * @param dimensionKey - interned dimension key (string)
	 */
	private hasDimension(parentMsgId: string, dimensionKey: string): boolean {
		const parentMap = this.msgStore.get(parentMsgId)
		if (!parentMap) return false
		return parentMap.has(dimensionKey)
	}

	/**
	 * Gets the dimension trace for a parent message and dimension.
	 * @param dimensionKey - interned dimension key (string)
	 */
	private getDimensionTrace(parentMsgId: string, dimensionKey: string): DimensionTrace {
		const parentMap = this.safeGet(this.dimensionStore, parentMsgId, 'dimensionStore')
		return this.safeGet(parentMap, dimensionKey, 'dimensionStore.parentMap')
	}

	/**
	 * Checks if dimension tracking exists for a parent message.
	 */
	private hasDimensionTracking(parentMsgId: string): boolean {
		return this.dimensionStore.has(parentMsgId)
	}

	/**
	 * Checks if a specific dimension is tracked for a parent message.
	 * @param dimensionKey - interned dimension key (string)
	 */
	private isDimensionTracked(parentMsgId: string, dimensionKey: string): boolean {
		const parentMap = this.dimensionStore.get(parentMsgId)
		if (!parentMap) return false
		return parentMap.has(dimensionKey)
	}

	/**
	 * Gets the box dimension array from cache (1.1 optimization).
	 */
	private getBoxDimension(boxName: string): string[] {
		return this.safeGet(this.boxDimensionCache, boxName, 'boxDimensionCache')
	}

	/**
	 * Gets the box dimension interned key from cache (1.1 + 1.4 optimization).
	 */
	private getBoxDimensionKey(boxName: string): string {
		return this.safeGet(this.boxDimensionKeyCache, boxName, 'boxDimensionKeyCache')
	}

	/**
	 * Gets the boxes that belong to a dimension from cache (1.2 optimization).
	 * @param dimensionKey - interned dimension key (string)
	 */
	private getDimensionBoxes(dimensionKey: string): string[] {
		return this.safeGet(this.dimensionBoxesCache, dimensionKey, 'dimensionBoxesCache')
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
		const dimensionKey = this.getBoxDimensionKey(boxName)

		if (this.hasMessage(parentMsgId, dimensionKey, msgId)) {
			this.markBoxAsPassed(parentMsgId, dimensionKey, msgId, boxName)
		} else {
			this.insertNewMsg(dimension, dimensionKey, boxName, parentMsgId, msgId)
		}

		this.checkMsgFinishState(msgId, parentMsgId, dimension, dimensionKey)
	}

	/**
	 * Marks a box as passed for an existing message trace.
	 * Uses bitfield operations when available, Map fallback otherwise.
	 * @param dimensionKey - interned dimension key (string)
	 */
	private markBoxAsPassed(
		parentMsgId: string,
		dimensionKey: string,
		msgId: string,
		boxName: string
	): void {
		const trace = this.getMessageTrace(parentMsgId, dimensionKey, msgId)

		if (trace.boxesPassed !== -1) {
			// Bitfield tracking: set the bit for this box
			const boxIndex = this.getBoxBitIndex(boxName)
			trace.boxesPassed |= 1 << boxIndex
		} else {
			// Map fallback
			trace.boxes?.set(boxName, true)
		}
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
		const dimensionKey = this.getBoxDimensionKey(boxName)

		// The dimension can be already deleted, if the child messages have completed
		// the flow through the dimension before (remind, all is asynchronous).
		if (!this.isDimensionTracked(parentMsgId, dimensionKey)) {
			return
		}

		this.getDimensionTrace(parentMsgId, dimensionKey).complete = true
		this.checkDimensionFinishState(parentMsgId, dimension, dimensionKey)
	}

	/**
	 * Inserts a new message into the tracking structure.
	 * @param dimension - original dimension array (for sub-dimension lookup)
	 * @param dimensionKey - interned dimension key (for map access)
	 */
	private insertNewMsg(
		dimension: string[],
		dimensionKey: string,
		boxName: string,
		parentMsgId: string,
		msgId: string
	): void {
		const msgTrace = this.createMsgTrace(dimensionKey, boxName)
		this.getDimensionMessages(parentMsgId, dimensionKey).set(msgId, msgTrace)

		// Phase 2.2: Increment child count for completion tracking
		this.getDimensionTrace(parentMsgId, dimensionKey).childCount++

		this.initializeSubDimensions(dimension, parentMsgId, msgId)
	}

	/**
	 * Creates a new MsgTrace for a message.
	 * Uses bitfield tracking for dimensions with ≤32 boxes, Map fallback otherwise.
	 * @param dimensionKey - interned dimension key (string)
	 * @param currentBox - the box that was just passed
	 */
	private createMsgTrace(dimensionKey: string, currentBox: string): MsgTrace {
		if (this.usesBitfield(dimensionKey)) {
			// Use bitfield tracking
			const boxIndex = this.getBoxBitIndex(currentBox)
			const boxesPassed = 1 << boxIndex
			const boxesRequired = this.getDimensionRequiredMask(dimensionKey)
			return {
				boxesPassed,
				boxesRequired,
				boxes: null,
				done: false
			}
		}

		// Fallback to Map-based tracking
		const boxFulfilled = this.createBoxFulfilledMap(dimensionKey, currentBox)
		return {
			boxesPassed: -1, // Signal that we're using Map fallback
			boxesRequired: -1,
			boxes: boxFulfilled,
			done: false
		}
	}

	/**
	 * Creates a map of boxes with their fulfilled status for a new message.
	 * Used as fallback for dimensions with >32 boxes.
	 * @param dimensionKey - interned dimension key (string)
	 */
	private createBoxFulfilledMap(dimensionKey: string, currentBox: string): Map<string, boolean> {
		const boxesToPass = this.getDimensionBoxes(dimensionKey)
		const boxFulfilled = new Map<string, boolean>()
		for (const b of boxesToPass) {
			boxFulfilled.set(b, b === currentBox)
		}
		return boxFulfilled
	}

	/**
	 * Initializes sub-dimension tracking for a new message if sub-dimensions exist.
	 * @param dimension - original dimension array (for graph lookup)
	 */
	private initializeSubDimensions(dimension: string[], parentMsgId: string, msgId: string): void {
		const subDimensions = this.getSubDimensions(dimension)
		if (subDimensions.length === 0) {
			return
		}

		const mySubdims = new Map<string, DimensionTrace>()
		this.msgStore.set(msgId, new Map<string, Map<string, MsgTrace>>())

		for (const subDim of subDimensions) {
			this.initializeSingleSubDimension(subDim, parentMsgId, msgId, mySubdims)
		}

		this.dimensionStore.set(msgId, mySubdims)
	}

	/**
	 * Initializes a single sub-dimension for tracking.
	 * @param subDim - original sub-dimension array
	 */
	private initializeSingleSubDimension(
		subDim: string[],
		parentMsgId: string,
		msgId: string,
		subDimMap: Map<string, DimensionTrace>
	): void {
		const subDimKey = this.getDimensionKey(subDim)
		subDimMap.set(subDimKey, {
			complete: false,
			done: false,
			superParentMsgId: parentMsgId,
			childCount: 0,
			doneChildCount: 0
		})
		const msgStoreEntry = this.msgStore.get(msgId)
		if (msgStoreEntry) {
			msgStoreEntry.set(subDimKey, new Map())
		}
	}

	/**
	 * Gets the sub-dimensions of a given dimension from the graph.
	 * @param dimension - original dimension array for graph lookup
	 */
	private getSubDimensions(dimension: string[]): string[][] {
		return this.dimGraph
			.inEdges(dimension)
			.map((e: Edge) => e[0] as string[])
			.filter((subDim): subDim is string[] => subDim !== undefined)
	}

	/**
	 * Checks if a message is finished and propagates completion if so.
	 * @param dimension - original dimension array (for graph operations)
	 * @param dimensionKey - interned dimension key (for map access)
	 */
	private checkMsgFinishState(
		msgId: string,
		parentMsgId: string,
		dimension: string[],
		dimensionKey: string
	): void {
		if (!this.isMessageComplete(msgId, parentMsgId, dimensionKey)) {
			return
		}

		this.markMessageComplete(msgId, parentMsgId, dimensionKey)
		this.propagateCompletion(msgId, parentMsgId, dimension, dimensionKey)
	}

	/**
	 * Checks if a message has completed all its boxes and sub-dimensions.
	 * @param dimensionKey - interned dimension key (string)
	 */
	private isMessageComplete(msgId: string, parentMsgId: string, dimensionKey: string): boolean {
		const boxesDone = this.getBoxesDone(msgId, parentMsgId, dimensionKey)
		if (!boxesDone) {
			return false
		}

		return this.getSubDimensionsDone(msgId)
	}

	/**
	 * Marks a message as complete and cleans up its tracking data.
	 * @param dimensionKey - interned dimension key (string)
	 */
	private markMessageComplete(msgId: string, parentMsgId: string, dimensionKey: string): void {
		// Phase 2.2: Increment done child count for completion tracking
		this.getDimensionTrace(parentMsgId, dimensionKey).doneChildCount++

		if (process.env.BAKERYJS_DISABLE_EXPERIMENTAL_TRACING) {
			this.getMessageTrace(parentMsgId, dimensionKey, msgId).done = true
		} else {
			this.getDimensionMessages(parentMsgId, dimensionKey).delete(msgId)
		}
		this.dimensionStore.delete(msgId)
	}

	/**
	 * Propagates completion to parent dimension or finishes the job.
	 * @param dimension - original dimension array (for isRootDimension check)
	 * @param dimensionKey - interned dimension key (for map access)
	 */
	private propagateCompletion(
		msgId: string,
		parentMsgId: string,
		dimension: string[],
		dimensionKey: string
	): void {
		if (this.isRootDimension(dimensionKey)) {
			this.finishRootJob(msgId, parentMsgId, dimensionKey)
			return
		}

		this.checkDimensionFinishState(parentMsgId, dimension, dimensionKey)
	}

	/**
	 * Checks if a dimension is the root dimension.
	 * @param dimensionKey - interned dimension key (root is empty string)
	 */
	private isRootDimension(dimensionKey: string): boolean {
		return dimensionKey === ''
	}

	/**
	 * Finishes a root job and invokes the completion callback.
	 * @param dimensionKey - interned dimension key (string)
	 */
	private finishRootJob(msgId: string, parentMsgId: string, dimensionKey: string): void {
		this.getDimensionMessages(parentMsgId, dimensionKey).delete(msgId)
		this.jobDone(msgId)
	}

	/**
	 * Checks if a dimension is done and propagates completion if so.
	 * @param dimension - original dimension array (for graph operations)
	 * @param dimensionKey - interned dimension key (for map access)
	 */
	private checkDimensionFinishState(
		parentMsgId: string,
		dimension: string[],
		dimensionKey: string
	): void {
		// The dimension may even have not started yet
		if (!this.hasDimension(parentMsgId, dimensionKey)) {
			return
		}

		if (!this.getDimensionDone(parentMsgId, dimensionKey)) {
			return
		}

		this.markDimensionComplete(parentMsgId, dimensionKey)
		this.propagateDimensionCompletion(parentMsgId, dimension, dimensionKey)
	}

	/**
	 * Marks a dimension as complete and cleans up child messages.
	 * @param dimensionKey - interned dimension key (string)
	 */
	private markDimensionComplete(parentMsgId: string, dimensionKey: string): void {
		this.getDimensionTrace(parentMsgId, dimensionKey).done = true
		const parentMap = this.msgStore.get(parentMsgId)
		if (parentMap) {
			parentMap.delete(dimensionKey)
		}
	}

	/**
	 * Propagates dimension completion to the parent message.
	 * @param dimension - original dimension array (for graph lookup)
	 * @param dimensionKey - interned dimension key (for map access)
	 */
	private propagateDimensionCompletion(
		parentMsgId: string,
		dimension: string[],
		dimensionKey: string
	): void {
		const parentDimension = this.getParentDimension(dimension)
		if (!parentDimension) {
			return
		}

		const superParentMsgId = this.getDimensionTrace(parentMsgId, dimensionKey).superParentMsgId
		const parentDimensionKey = this.getDimensionKey(parentDimension)
		this.checkMsgFinishState(parentMsgId, superParentMsgId, parentDimension, parentDimensionKey)
	}

	/**
	 * Gets the parent dimension from the dimension graph.
	 * @param dimension - original dimension array for graph lookup
	 */
	private getParentDimension(dimension: string[]): string[] | null {
		const outEdges = this.dimGraph.outEdges(dimension)
		const firstEdge = outEdges[0]
		if (!firstEdge) {
			return null
		}
		return firstEdge[1] as string[]
	}

	/**
	 * Checks if all sub-dimensions of a message are done.
	 */
	private getSubDimensionsDone(msgId: string): boolean {
		if (!this.hasDimensionTracking(msgId)) {
			return true
		}

		const dimStore = this.dimensionStore.get(msgId)
		if (!dimStore) {
			return true
		}
		return everyMap(dimStore, (dt: DimensionTrace) => dt.complete && dt.done)
	}

	/**
	 * Checks if all messages in a dimension are done.
	 * Phase 2.2: Uses counter comparison for O(1) instead of O(n) iteration.
	 * @param dimensionKey - interned dimension key (string)
	 */
	private getDimensionDone(parentMsgId: string, dimensionKey: string): boolean {
		const trace = this.getDimensionTrace(parentMsgId, dimensionKey)

		// Must be complete (all children generated) to be done
		if (!trace.complete) {
			return false
		}

		// Phase 2.2: O(1) counter comparison instead of O(n) everyMap iteration
		return trace.doneChildCount === trace.childCount
	}

	/**
	 * Checks if all boxes are done for a message.
	 * Uses bitfield comparison when available, Map iteration fallback otherwise.
	 * @param dimensionKey - interned dimension key (string)
	 */
	private getBoxesDone(msgId: string, parentMsgId: string, dimensionKey: string): boolean {
		const trace = this.getMessageTrace(parentMsgId, dimensionKey, msgId)

		if (trace.boxesPassed !== -1) {
			// Bitfield tracking: check if all required bits are set
			return (trace.boxesPassed & trace.boxesRequired) === trace.boxesRequired
		}

		// Map fallback
		return everyMap(trace.boxes as Map<string, boolean>, Boolean)
	}
}
