/**
 * Entry stored in the binary heap.
 * @internal
 */
interface HeapEntry<T> {
	item: T
	priority: number
	insertionOrder: number // For FIFO within same priority
}

/**
 * Binary max-heap implementation with O(log n) insert and extract operations.
 *
 * This is an internal implementation detail used by FastPriorityQueue.
 * Items with higher priority values are extracted first.
 * Items with the same priority are extracted in FIFO order (first inserted, first extracted).
 *
 * @internal
 */
export class BinaryHeap<T> {
	private heap: HeapEntry<T>[] = []
	private insertionCounter = 0

	/**
	 * Insert an item with the given priority.
	 * Complexity: O(log n)
	 *
	 * @param item - The item to insert
	 * @param priority - Priority value (higher = more important, extracted first)
	 */
	public insert(item: T, priority: number): void {
		const entry: HeapEntry<T> = {
			item,
			priority,
			insertionOrder: this.insertionCounter++
		}
		this.heap.push(entry)
		this.bubbleUp(this.heap.length - 1)
	}

	/**
	 * Extract the highest priority item from the heap.
	 * Complexity: O(log n)
	 *
	 * @returns The highest priority item, or undefined if the heap is empty
	 */
	public extractMax(): T | undefined {
		if (this.heap.length === 0) {
			return undefined
		}

		const max = this.heap[0]
		const last = this.heap.pop()

		if (this.heap.length > 0 && last !== undefined) {
			this.heap[0] = last
			this.bubbleDown(0)
		}

		return max?.item
	}

	/**
	 * Extract up to n highest priority items from the heap.
	 * Complexity: O(n log n) where n is the number of items to extract
	 *
	 * @param n - Maximum number of items to extract
	 * @returns Array of extracted items (may be less than n if heap has fewer items)
	 */
	public extractN(n: number): T[] {
		const result: T[] = []
		const count = Math.min(n, this.heap.length)

		for (let i = 0; i < count; i++) {
			const item = this.extractMax()
			if (item !== undefined) {
				result.push(item)
			}
		}

		return result
	}

	/**
	 * Peek at the highest priority item without removing it.
	 * Complexity: O(1)
	 *
	 * @returns The highest priority item, or undefined if the heap is empty
	 */
	public peek(): T | undefined {
		return this.heap[0]?.item
	}

	/**
	 * Current number of items in the heap.
	 * Complexity: O(1)
	 */
	public get size(): number {
		return this.heap.length
	}

	/**
	 * Check if the heap is empty.
	 * Complexity: O(1)
	 */
	public get isEmpty(): boolean {
		return this.heap.length === 0
	}

	/**
	 * Bubble up an entry at the given index to maintain heap property.
	 * @internal
	 */
	private bubbleUp(index: number): void {
		while (index > 0) {
			const parentIndex = Math.floor((index - 1) / 2)
			const current = this.heap[index]
			const parent = this.heap[parentIndex]

			if (!current || !parent) {
				break
			}

			if (this.compare(current, parent) <= 0) {
				break
			}

			// Swap
			this.heap[index] = parent
			this.heap[parentIndex] = current
			index = parentIndex
		}
	}

	/**
	 * Bubble down an entry at the given index to maintain heap property.
	 * @internal
	 */
	private bubbleDown(index: number): void {
		const length = this.heap.length

		while (true) {
			const leftChildIndex = 2 * index + 1
			const rightChildIndex = 2 * index + 2
			let largestIndex = index

			const current = this.heap[index]
			const leftChild = this.heap[leftChildIndex]
			const rightChild = this.heap[rightChildIndex]
			const largest = this.heap[largestIndex]

			if (!current || !largest) {
				break
			}

			if (leftChildIndex < length && leftChild && this.compare(leftChild, largest) > 0) {
				largestIndex = leftChildIndex
			}

			const newLargest = this.heap[largestIndex]
			if (
				rightChildIndex < length &&
				rightChild &&
				newLargest &&
				this.compare(rightChild, newLargest) > 0
			) {
				largestIndex = rightChildIndex
			}

			if (largestIndex === index) {
				break
			}

			// Swap
			const swapTarget = this.heap[largestIndex]
			if (swapTarget) {
				this.heap[index] = swapTarget
				this.heap[largestIndex] = current
			}
			index = largestIndex
		}
	}

	/**
	 * Compare two heap entries.
	 * Returns positive if a should come before b (higher priority).
	 * For same priority, lower insertion order comes first (FIFO).
	 * @internal
	 */
	private compare(a: HeapEntry<T>, b: HeapEntry<T>): number {
		if (a.priority !== b.priority) {
			return a.priority - b.priority
		}
		// Same priority: lower insertion order = earlier insertion = should come first
		// We want FIFO, so earlier (lower) insertion order should have "higher" priority
		return b.insertionOrder - a.insertionOrder
	}
}
