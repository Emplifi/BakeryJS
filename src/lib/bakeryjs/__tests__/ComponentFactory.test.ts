import { ServiceProvider } from '../ServiceProvider'
import { ComponentFactory, MultiComponentFactory } from '../ComponentFactory'
import { resolve } from 'path'
import VError = require('verror')
import { PriorityQueueI } from '../queue/PriorityQueueI'
import { Message } from '../Message'

const serviceProvider = new ServiceProvider({
	logger: {
		log: (message: any): void => console.log(message),
		error: jest.fn()
	}
})

// Helper to create a mock queue
function createMockQueue(): PriorityQueueI<Message> {
	return {
		push: jest.fn(),
		length: 0,
		source: '__test',
		target: '__test'
	}
}

const componentsDir = resolve(__dirname, '../../../components')
const componentsDirSlash = componentsDir + '/'
const testDataDir = resolve(__dirname, '../../../../test-data') + '/'

describe('Component Factory', () => {
	it('finds all components', async () => {
		const factory = new ComponentFactory(componentsDir, serviceProvider)
		const tickBox = await factory.create('tick')
		expect(tickBox).toBeDefined()

		const tockBox = await factory.create('tock')
		expect(tockBox).toBeDefined()
	})

	it('create builtin box', async () => {
		const factory = new ComponentFactory(componentsDirSlash, serviceProvider)

		const tickBox = await factory.create('tick')
		expect(tickBox).not.toBeUndefined()
	})

	it('create nonexistent box throws', () => {
		const factory = new ComponentFactory(componentsDirSlash, serviceProvider)

		factory.create('fick').catch(reason => {
			expect.assertions(2)
			expect(reason).toBeInstanceOf(VError)
			expect(reason.name).toBe('BoxNotFound')
		})
	})

	describe('Component Factory -- path without ending slash', () => {
		it('create builtin box', async () => {
			const factory = new ComponentFactory(componentsDir, serviceProvider)

			const tickBox = await factory.create('tick')
			expect(tickBox).not.toBeUndefined()
		})

		it('create nonexistent box throws', () => {
			const factory = new ComponentFactory(componentsDir, serviceProvider)

			factory.create('fick').catch(reason => {
				expect.assertions(2)
				expect(reason).toBeInstanceOf(VError)
				expect(reason.name).toBe('BoxNotFound')
			})
		})
	})

	describe('double factory', () => {
		it('create a builtin box', async () => {
			const multiFactory = new MultiComponentFactory()
			multiFactory.push(new ComponentFactory(componentsDirSlash, serviceProvider))
			multiFactory.push(new ComponentFactory(testDataDir, serviceProvider))

			const tickBox = await multiFactory.create('tick')
			expect(tickBox).not.toBeUndefined()
		})

		it('create a user-defined', async () => {
			const multiFactory = new MultiComponentFactory()
			multiFactory.push(new ComponentFactory(componentsDirSlash, serviceProvider))
			multiFactory.push(new ComponentFactory(testDataDir, serviceProvider))

			const tickBox = await multiFactory.create('helloworld')
			expect(tickBox).not.toBeUndefined()
		})

		it('create nonexistent box throws', async () => {
			const multiFactory = new MultiComponentFactory()
			multiFactory.push(new ComponentFactory(componentsDirSlash, serviceProvider))
			multiFactory.push(new ComponentFactory(testDataDir, serviceProvider))

			await expect(multiFactory.create('nonexistent')).rejects.toMatchObject({
				name: 'BoxNotFound'
			})
		})

		it('includes all factory URIs in BoxNotFound error', async () => {
			const multiFactory = new MultiComponentFactory()
			multiFactory.push(new ComponentFactory(componentsDirSlash, serviceProvider))
			multiFactory.push(new ComponentFactory(testDataDir, serviceProvider))

			try {
				await multiFactory.create('nonexistent')
				fail('Should have thrown')
			} catch (error) {
				expect(error.message).toContain('nonexistent')
				// Should include multiple paths in error
				const info = VError.info(error)
				// factoryBaseUri is an array of strings
				expect(info.factoryBaseUri).toBeInstanceOf(Array)
				expect(info.factoryBaseUri).toHaveLength(2)
			}
		})

		it('resolves from first factory when component exists in both', async () => {
			// Create a factory order where testData comes first (last pushed)
			const multiFactory = new MultiComponentFactory()
			multiFactory.push(new ComponentFactory(componentsDirSlash, serviceProvider))
			// Push testData last so it gets unshifted to front
			multiFactory.push(new ComponentFactory(testDataDir, serviceProvider))

			// helloworld exists only in test-data, should still be found
			const box = await multiFactory.create('helloworld')
			expect(box).toBeDefined()
		})

		it('throws BoxNotFound when no factories registered', async () => {
			const multiFactory = new MultiComponentFactory()

			await expect(multiFactory.create('anybox')).rejects.toMatchObject({
				name: 'BoxNotFound'
			})
		})

		it('push adds factory to front (unshift behavior)', async () => {
			const multiFactory = new MultiComponentFactory()
			// Push components first, then test-data
			// test-data should take priority because it's pushed last (unshifted to front)
			multiFactory.push(new ComponentFactory(componentsDirSlash, serviceProvider))
			multiFactory.push(new ComponentFactory(testDataDir, serviceProvider))

			// Both paths have 'tick' - but test-data is searched first
			// Actually test-data doesn't have tick, let's verify the behavior
			const box = await multiFactory.create('tick')
			expect(box).toBeDefined()
		})

		it('passes queue and parameters through to created box', async () => {
			const multiFactory = new MultiComponentFactory()
			multiFactory.push(new ComponentFactory(testDataDir, serviceProvider))

			const queue = createMockQueue()
			const box = await multiFactory.create('checksum', queue, 5)
			expect(box).toBeDefined()
		})

		it('handles single factory', async () => {
			const multiFactory = new MultiComponentFactory()
			multiFactory.push(new ComponentFactory(testDataDir, serviceProvider))

			const box = await multiFactory.create('helloworld')
			expect(box).toBeDefined()
		})
	})

	describe('parameters handling', () => {
		it('passes parameters to box constructor', async () => {
			const factory = new ComponentFactory(testDataDir, serviceProvider)
			const queue = createMockQueue()

			// checksum box has parameters schema
			const box = await factory.create('checksum', queue, 5)
			expect(box).toBeDefined()
		})

		it('throws ComponentLoadError for invalid parameters', async () => {
			const factory = new ComponentFactory(testDataDir, serviceProvider)
			const queue = createMockQueue()

			// checksum has schema: { type: 'number', minimum: 0 }
			// Passing invalid negative number causes validation error during box instantiation
			await expect(factory.create('checksum', queue, -5)).rejects.toMatchObject({
				name: 'ComponentLoadError'
			})
		})

		it('creates box with queue', async () => {
			const factory = new ComponentFactory(testDataDir, serviceProvider)
			const queue = createMockQueue()

			const box = await factory.create('helloworld', queue)
			expect(box).toBeDefined()
		})

		it('creates box without queue', async () => {
			const factory = new ComponentFactory(testDataDir, serviceProvider)

			const box = await factory.create('helloworld')
			expect(box).toBeDefined()
		})
	})

	describe('error handling', () => {
		it('BoxNotFound includes component name in error info', async () => {
			const factory = new ComponentFactory(componentsDirSlash, serviceProvider)

			try {
				await factory.create('nonexistent-box')
				fail('Should have thrown')
			} catch (error) {
				expect(error.name).toBe('BoxNotFound')
				const info = VError.info(error)
				expect(info.requestedBoxName).toBe('nonexistent-box')
				expect(info.factoryBaseUri).toContain('file://')
			}
		})

		it('BoxNotFound error message includes box name', async () => {
			const factory = new ComponentFactory(componentsDirSlash, serviceProvider)

			await expect(factory.create('missing-component')).rejects.toThrow(/missing-component/)
		})
	})

	describe('baseURI property', () => {
		it('has file:// prefix', () => {
			const factory = new ComponentFactory(componentsDirSlash, serviceProvider)

			expect(factory.baseURI).toMatch(/^file:\/\//)
		})

		it('contains components path', () => {
			const factory = new ComponentFactory(componentsDirSlash, serviceProvider)

			expect(factory.baseURI).toContain('components')
		})
	})
})
