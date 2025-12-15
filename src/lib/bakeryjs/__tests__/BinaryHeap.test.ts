import { BinaryHeap } from '../queue/BinaryHeap'

describe('BinaryHeap', () => {
	describe('basic operations', () => {
		test('starts empty', () => {
			const heap = new BinaryHeap<number>()
			expect(heap.size).toBe(0)
			expect(heap.isEmpty).toBe(true)
			expect(heap.peek()).toBeUndefined()
			expect(heap.extractMax()).toBeUndefined()
		})

		test('insert and extract single item', () => {
			const heap = new BinaryHeap<string>()
			heap.insert('hello', 1)

			expect(heap.size).toBe(1)
			expect(heap.isEmpty).toBe(false)
			expect(heap.peek()).toBe('hello')
			expect(heap.extractMax()).toBe('hello')
			expect(heap.isEmpty).toBe(true)
		})

		test('insert multiple items with different priorities', () => {
			const heap = new BinaryHeap<string>()
			heap.insert('low', 1)
			heap.insert('high', 10)
			heap.insert('medium', 5)

			expect(heap.size).toBe(3)
			expect(heap.extractMax()).toBe('high')
			expect(heap.extractMax()).toBe('medium')
			expect(heap.extractMax()).toBe('low')
			expect(heap.isEmpty).toBe(true)
		})
	})

	describe('priority ordering', () => {
		test('higher priority items extracted first', () => {
			const heap = new BinaryHeap<number>()
			heap.insert(1, 1)
			heap.insert(2, 2)
			heap.insert(3, 3)
			heap.insert(4, 4)
			heap.insert(5, 5)

			expect(heap.extractMax()).toBe(5)
			expect(heap.extractMax()).toBe(4)
			expect(heap.extractMax()).toBe(3)
			expect(heap.extractMax()).toBe(2)
			expect(heap.extractMax()).toBe(1)
		})

		test('handles negative priorities', () => {
			const heap = new BinaryHeap<string>()
			heap.insert('negative', -5)
			heap.insert('zero', 0)
			heap.insert('positive', 5)

			expect(heap.extractMax()).toBe('positive')
			expect(heap.extractMax()).toBe('zero')
			expect(heap.extractMax()).toBe('negative')
		})
	})

	describe('FIFO within same priority', () => {
		test('items with same priority extracted in insertion order', () => {
			const heap = new BinaryHeap<string>()
			heap.insert('first', 1)
			heap.insert('second', 1)
			heap.insert('third', 1)
			heap.insert('fourth', 1)

			expect(heap.extractMax()).toBe('first')
			expect(heap.extractMax()).toBe('second')
			expect(heap.extractMax()).toBe('third')
			expect(heap.extractMax()).toBe('fourth')
		})

		test('FIFO within same priority while respecting priority order', () => {
			const heap = new BinaryHeap<string>()
			heap.insert('low-first', 1)
			heap.insert('high-first', 10)
			heap.insert('low-second', 1)
			heap.insert('high-second', 10)
			heap.insert('low-third', 1)

			expect(heap.extractMax()).toBe('high-first')
			expect(heap.extractMax()).toBe('high-second')
			expect(heap.extractMax()).toBe('low-first')
			expect(heap.extractMax()).toBe('low-second')
			expect(heap.extractMax()).toBe('low-third')
		})
	})

	describe('extractN', () => {
		test('extracts up to n items', () => {
			const heap = new BinaryHeap<number>()
			heap.insert(1, 1)
			heap.insert(2, 2)
			heap.insert(3, 3)
			heap.insert(4, 4)
			heap.insert(5, 5)

			const batch = heap.extractN(3)
			expect(batch).toEqual([5, 4, 3])
			expect(heap.size).toBe(2)
		})

		test('returns all items if n > size', () => {
			const heap = new BinaryHeap<number>()
			heap.insert(1, 1)
			heap.insert(2, 2)

			const batch = heap.extractN(10)
			expect(batch).toEqual([2, 1])
			expect(heap.isEmpty).toBe(true)
		})

		test('returns empty array from empty heap', () => {
			const heap = new BinaryHeap<number>()
			const batch = heap.extractN(5)
			expect(batch).toEqual([])
		})

		test('extractN with n=0 returns empty array', () => {
			const heap = new BinaryHeap<number>()
			heap.insert(1, 1)
			const batch = heap.extractN(0)
			expect(batch).toEqual([])
			expect(heap.size).toBe(1)
		})
	})

	describe('peek', () => {
		test('peek does not remove item', () => {
			const heap = new BinaryHeap<string>()
			heap.insert('item', 1)

			expect(heap.peek()).toBe('item')
			expect(heap.peek()).toBe('item')
			expect(heap.size).toBe(1)
		})

		test('peek returns highest priority item', () => {
			const heap = new BinaryHeap<string>()
			heap.insert('low', 1)
			heap.insert('high', 10)

			expect(heap.peek()).toBe('high')
		})
	})
})
