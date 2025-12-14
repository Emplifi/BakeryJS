import { DataMessage } from '../Message'

describe('Message', () => {
	const inputTestData = [
		{
			init: {},
			requires: [],
			expected: {}
		},
		{
			init: { foo: 0, bar: 1 },
			requires: ['foo'],
			expected: { foo: 0 }
		},
		{
			init: { foo: 0, bar: 1 },
			requires: ['baz'],
			expected: { baz: undefined }
		}
	]

	inputTestData.forEach(({ init, requires, expected }, index: number) => {
		it(`returns partial data as input #${index}`, () => {
			const message = new DataMessage(init)
			const input = message.getInput(requires)
			expect(input).toEqual(expected)
		})
	})

	const outputTestData = [
		{
			init: {},
			provides: [],
			data: {},
			expected: {}
		},
		{
			init: {},
			provides: ['foo'],
			data: { foo: 0 },
			expected: { foo: 0 }
		},
		{
			init: { bar: 1 },
			provides: ['foo'],
			data: { foo: 0 },
			expected: { bar: 1, foo: 0 }
		},
		{
			init: {},
			provides: ['foo'],
			data: {},
			expected: { foo: undefined }
		}
	]

	outputTestData.forEach(({ init, provides, data, expected }, index: number) => {
		it(`saves output data to the message #${index}`, () => {
			const message = new DataMessage(init)
			message.setOutput(provides, data)
			expect(message.getInput(['foo', 'bar'])).toEqual(expected)
		})
	})

	it('throws an error on rewriting existing data key by an output without any changes', () => {
		const message = new DataMessage({ foo: 0, bar: 1 })

		expect(() => {
			message.setOutput(['baz', 'bar'], { baz: 2, bar: 3 })
		}).toThrowError(
			new Error(
				'Cannot provide some data because the message already contains following results "bar".'
			)
		)

		expect(message.getInput(['foo', 'bar', 'baz'])).toEqual({
			foo: 0,
			bar: 1
		})
	})

	describe('Parent message', () => {
		const parentMessage = new DataMessage({ foo: 1, bar: 'hello' })
		const message = parentMessage.create()

		it("message.id contains parent message's id", () => {
			expect(message.id).toEqual(expect.stringContaining(parentMessage.id))
		})

		it('Parent data are accessible in the message data', () => {
			expect(message.getInput(['bar'])).toEqual({ bar: 'hello' })
		})

		it("Write into the message doesn't touch the parent", () => {
			message.setOutput(['baz'], { baz: 'world!' })

			expect(message.getInput(['baz'])).toEqual({ baz: 'world!' })
			expect(parentMessage.getInput(['baz'])).toEqual({ baz: undefined })
		})
	})

	describe('Message ID generation', () => {
		it('generates unique IDs for each message', () => {
			const msg1 = new DataMessage({})
			const msg2 = new DataMessage({})
			const msg3 = new DataMessage({})

			expect(msg1.id).not.toEqual(msg2.id)
			expect(msg2.id).not.toEqual(msg3.id)
			expect(msg1.id).not.toEqual(msg3.id)
		})

		it('ID starts with / for root messages', () => {
			const msg = new DataMessage({})
			expect(msg.id).toMatch(/^\//)
		})

		it('hierarchical ID includes parent ID as prefix', () => {
			const parent = new DataMessage({})
			const child = parent.create()
			const grandchild = child.create()

			expect(child.id).toMatch(new RegExp(`^${parent.id}/`))
			expect(grandchild.id).toMatch(new RegExp(`^${child.id}/`))
			expect(grandchild.id).toMatch(new RegExp(`^${parent.id}/`))
		})
	})

	describe('create() method', () => {
		it('creates child with initial values', () => {
			const parent = new DataMessage({ foo: 'parent' })
			const child = parent.create({ bar: 'child' })

			expect(child.getInput(['foo'])).toEqual({ foo: 'parent' })
			expect(child.getInput(['bar'])).toEqual({ bar: 'child' })
		})

		it('creates child without initial values', () => {
			const parent = new DataMessage({ foo: 'parent' })
			const child = parent.create()

			expect(child.getInput(['foo'])).toEqual({ foo: 'parent' })
		})

		it('child initial values can shadow parent values via prototype', () => {
			const parent = new DataMessage({ foo: 'parent', bar: 'parent' })
			const child = parent.create({ foo: 'child' })

			// The child's own foo shadows parent's foo
			expect(child.getInput(['foo'])).toEqual({ foo: 'child' })
			// bar is still accessible from parent
			expect(child.getInput(['bar'])).toEqual({ bar: 'parent' })
		})

		it('sets parent reference correctly', () => {
			const parent = new DataMessage({})
			const child = parent.create()

			expect(child.parent).toBe(parent)
		})

		it('root message has undefined parent', () => {
			const root = new DataMessage({})
			expect(root.parent).toBeUndefined()
		})
	})

	describe('export() method', () => {
		it('returns flat object from single message', () => {
			const msg = new DataMessage({ foo: 1, bar: 'hello' })
			const exported = msg.export()

			expect(exported).toEqual({ foo: 1, bar: 'hello' })
		})

		it('flattens prototype chain from parent-child', () => {
			const parent = new DataMessage({ foo: 1, bar: 'hello' })
			parent.setOutput(['baz'], { baz: true })
			const child = parent.create({ qux: 42 }) as DataMessage

			const exported = child.export()

			expect(exported).toEqual({
				foo: 1,
				bar: 'hello',
				baz: true,
				qux: 42
			})
		})

		it('flattens deep prototype chain (3+ levels)', () => {
			const root = new DataMessage({ level: 0 })
			const child1 = root.create({ level: 1 }) as DataMessage
			child1.setOutput(['added1'], { added1: 'one' })
			const child2 = child1.create({ level: 2 }) as DataMessage
			child2.setOutput(['added2'], { added2: 'two' })
			const child3 = child2.create({ level: 3 }) as DataMessage

			const exported = child3.export()

			expect(exported).toEqual({
				level: 3, // Overwritten at each level via create()
				added1: 'one',
				added2: 'two'
			})
		})

		it('exported object is a plain object, not prototype-linked', () => {
			const parent = new DataMessage({ foo: 1 })
			const child = parent.create({ bar: 2 }) as DataMessage

			const exported = child.export()

			// Verify it's a plain object
			expect(Object.getPrototypeOf(exported)).toBe(Object.prototype)
			// Verify own properties
			expect(Object.keys(exported).sort()).toEqual(['bar', 'foo'])
		})
	})

	describe('Edge cases', () => {
		it('handles null field values', () => {
			const msg = new DataMessage({ foo: null })
			expect(msg.getInput(['foo'])).toEqual({ foo: null })

			msg.setOutput(['bar'], { bar: null })
			expect(msg.getInput(['bar'])).toEqual({ bar: null })
		})

		it('handles undefined field values', () => {
			const msg = new DataMessage({ foo: undefined })
			expect(msg.getInput(['foo'])).toEqual({ foo: undefined })
		})

		it('handles empty arrays as values', () => {
			const msg = new DataMessage({ arr: [] })
			expect(msg.getInput(['arr'])).toEqual({ arr: [] })
		})

		it('handles complex nested objects', () => {
			const complex = {
				nested: {
					deep: {
						value: 42
					}
				},
				array: [1, 2, { x: 3 }]
			}
			const msg = new DataMessage(complex)
			const input = msg.getInput(['nested', 'array'])

			expect(input.nested).toBe(complex.nested) // Same reference
			expect(input.array).toBe(complex.array) // Same reference
		})

		it('handles message created with no initial data', () => {
			const msg = new DataMessage()
			expect(msg.getInput([])).toEqual({})
			expect(msg.getInput(['nonexistent'])).toEqual({
				nonexistent: undefined
			})
		})

		it('setOutput with multiple duplicate keys throws listing all', () => {
			const msg = new DataMessage({ foo: 1, bar: 2, baz: 3 })

			expect(() => {
				msg.setOutput(['foo', 'bar'], { foo: 10, bar: 20 })
			}).toThrowError(/foo.*bar|bar.*foo/)
		})
	})

	describe('Deep nesting', () => {
		it('supports multiple levels of parent-child relationships', () => {
			const root = new DataMessage({ rootField: 'root' })
			const level1 = root.create()
			level1.setOutput(['l1Field'], { l1Field: 'level1' })
			const level2 = level1.create()
			level2.setOutput(['l2Field'], { l2Field: 'level2' })
			const level3 = level2.create()
			level3.setOutput(['l3Field'], { l3Field: 'level3' })

			// All parent data accessible at deepest level
			expect(level3.getInput(['rootField'])).toEqual({
				rootField: 'root'
			})
			expect(level3.getInput(['l1Field'])).toEqual({ l1Field: 'level1' })
			expect(level3.getInput(['l2Field'])).toEqual({ l2Field: 'level2' })
			expect(level3.getInput(['l3Field'])).toEqual({ l3Field: 'level3' })
		})

		it('parent chain is correctly maintained', () => {
			const root = new DataMessage({})
			const level1 = root.create()
			const level2 = level1.create()
			const level3 = level2.create()

			expect(level3.parent).toBe(level2)
			expect(level2.parent).toBe(level1)
			expect(level1.parent).toBe(root)
			expect(root.parent).toBeUndefined()
		})

		it('IDs encode full ancestry path', () => {
			const root = new DataMessage({})
			const level1 = root.create()
			const level2 = level1.create()
			const level3 = level2.create()

			// Count number of slashes in ID to verify depth
			const slashCount = (level3.id.match(/\//g) || []).length
			expect(slashCount).toBe(4) // root + 3 children = 4 slashes
		})
	})
})
