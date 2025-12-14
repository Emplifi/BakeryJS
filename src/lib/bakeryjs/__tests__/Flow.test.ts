import { Flow, hasFlow, hasProcess } from '../Flow'
import { Job } from '../Job'
import { MemoryPrioritySingleQueue } from '../queue/MemoryPriorityQueue'
import { Message } from '../Message'
import { DiGraph } from 'sb-jsnetworkx'
import { EventEmitter } from 'events'
import { ROOT_NODE } from '../builders/DAGBuilder/builder'
import { BoxInterface, BoxMeta } from '../BoxI'

/**
 * Helper to create a mock box instance with proper event emitter behavior
 */
function createMockBox(name: string, dimension: string[] = []): BoxInterface {
	const emitter = new EventEmitter()
	const meta: BoxMeta = {
		provides: [],
		requires: [],
		emits: [],
		aggregates: false
	}
	return ({
		name,
		meta,
		process: jest.fn().mockResolvedValue(undefined),
		on: emitter.on.bind(emitter),
		emit: emitter.emit.bind(emitter),
		onClean: []
	} as unknown) as BoxInterface
}

/**
 * Helper to create a simple box graph with ROOT_NODE and boxes
 */
function createBoxGraph(boxNames: string[]): DiGraph {
	const graph = new DiGraph()
	const rootDimension: string[] = []

	// Add ROOT_NODE
	graph.addNode(ROOT_NODE, {
		dimension: rootDimension,
		instance: createMockBox(ROOT_NODE)
	})

	// Add boxes with instances
	let prevBox = ROOT_NODE
	for (const boxName of boxNames) {
		const mockBox = createMockBox(boxName, rootDimension)
		graph.addNode(boxName, { dimension: rootDimension, instance: mockBox })
		// Edge from current box to previous (reverse direction for tracing)
		graph.addEdge(boxName, prevBox)
		prevBox = boxName
	}

	return graph
}

describe('Flow', () => {
	describe('constructor', () => {
		it('creates flow with queue and graph', () => {
			const queue = new MemoryPrioritySingleQueue(
				(task: Message) => Promise.resolve(),
				{ concurrency: 1 },
				'__root__'
			)
			const graph = new DiGraph()
			graph.addNode(ROOT_NODE, { dimension: [] })

			const flow = new Flow(queue, graph)
			expect(flow).toBeInstanceOf(Flow)
		})

		it('extends EventEmitter', () => {
			const queue = new MemoryPrioritySingleQueue(
				(task: Message) => Promise.resolve(),
				{ concurrency: 1 },
				'__root__'
			)
			const graph = new DiGraph()
			graph.addNode(ROOT_NODE, { dimension: [] })

			const flow = new Flow(queue, graph)
			expect(flow).toBeInstanceOf(EventEmitter)
		})

		it('subscribes to box msg_finished events', () => {
			const queue = new MemoryPrioritySingleQueue(
				(task: Message) => Promise.resolve(),
				{ concurrency: 1 },
				'__root__'
			)
			const graph = createBoxGraph(['boxA'])
			const boxANode = graph.node.get('boxA')
			const boxA = boxANode?.instance
			if (!boxA) {
				throw new Error('boxA should be defined')
			}
			const onSpy = jest.spyOn(boxA, 'on')

			// Creating flow subscribes to events
			new Flow(queue, graph)

			expect(onSpy).toHaveBeenCalledWith('msg_finished', expect.any(Function))
			expect(onSpy).toHaveBeenCalledWith('generation_finished', expect.any(Function))
		})
	})

	describe('process', () => {
		it('enqueues job as a message', () => {
			const queue = new MemoryPrioritySingleQueue(
				(task: Message) => Promise.resolve(),
				{ concurrency: 1 },
				'__root__'
			)
			const spyOnPush = jest.spyOn(queue, 'push')

			const flow = new Flow(queue, new DiGraph())
			flow.process(new Job())

			expect(spyOnPush).toHaveBeenCalledTimes(1)
		})

		it('pushes message with priority 1', () => {
			const queue = new MemoryPrioritySingleQueue(
				(task: Message) => Promise.resolve(),
				{ concurrency: 1 },
				'__root__'
			)
			const spyOnPush = jest.spyOn(queue, 'push')

			const graph = new DiGraph()
			graph.addNode(ROOT_NODE, { dimension: [] })
			const flow = new Flow(queue, graph)
			flow.process(new Job())

			expect(spyOnPush).toHaveBeenCalledWith(expect.any(Object), 1)
		})

		it('returns a promise', () => {
			const queue = new MemoryPrioritySingleQueue(
				(task: Message) => Promise.resolve(),
				{ concurrency: 1 },
				'__root__'
			)

			const graph = new DiGraph()
			graph.addNode(ROOT_NODE, { dimension: [] })
			const flow = new Flow(queue, graph)
			const result = flow.process(new Job())

			expect(result).toBeInstanceOf(Promise)
		})

		it('includes initial job values in message', async () => {
			let capturedMessage: Message | undefined
			let resolveCapture: () => void
			const capturePromise = new Promise<void>(resolve => {
				resolveCapture = resolve
			})
			const queue = new MemoryPrioritySingleQueue(
				(task: Message) => {
					capturedMessage = task
					resolveCapture()
					return Promise.resolve()
				},
				{ concurrency: 1 },
				'__root__'
			)

			const graph = new DiGraph()
			graph.addNode(ROOT_NODE, { dimension: [] })
			const flow = new Flow(queue, graph)
			flow.process(new Job({ customField: 'value' }))

			// Wait for the queue to process the message
			await capturePromise

			expect(capturedMessage).toBeDefined()
			// Job values are accessible via getInput
			const msg = capturedMessage as Message
			const input = msg.getInput(['customField'])
			expect(input.customField).toBe('value')
		})
	})

	describe('task_finish event', () => {
		it('emits task_finish when job completes', async () => {
			const queue = new MemoryPrioritySingleQueue(
				(task: Message) => Promise.resolve(),
				{ concurrency: 1 },
				'__root__'
			)

			// Create graph with just ROOT_NODE (empty flow completes immediately)
			const graph = new DiGraph()
			const rootDim: string[] = []
			graph.addNode(ROOT_NODE, {
				dimension: rootDim,
				instance: createMockBox(ROOT_NODE)
			})

			const flow = new Flow(queue, graph)
			const taskFinishSpy = jest.fn()
			flow.on('task_finish', taskFinishSpy)

			const job = new Job()
			await flow.process(job)

			expect(taskFinishSpy).toHaveBeenCalled()
		})
	})

	describe('destroy', () => {
		it('is an async method that resolves', async () => {
			const queue = new MemoryPrioritySingleQueue(
				(task: Message) => Promise.resolve(),
				{ concurrency: 1 },
				'__root__'
			)

			const graph = new DiGraph()
			graph.addNode(ROOT_NODE, { dimension: [] })
			const flow = new Flow(queue, graph)

			await expect(flow.destroy()).resolves.toBeUndefined()
		})
	})
})

describe('Flow type guards', () => {
	describe('hasFlow', () => {
		it('returns true for FlowIdDesc', () => {
			expect(hasFlow({ flow: 'myFlow' })).toBe(true)
		})

		it('returns false for FlowExplicitDescription', () => {
			expect(hasFlow({ process: [['boxA']] })).toBe(false)
		})

		it('returns false for empty object', () => {
			expect(hasFlow({} as any)).toBe(false)
		})
	})

	describe('hasProcess', () => {
		it('returns true for FlowExplicitDescription', () => {
			expect(hasProcess({ process: [['boxA']] })).toBe(true)
		})

		it('returns false for FlowIdDesc', () => {
			expect(hasProcess({ flow: 'myFlow' })).toBe(false)
		})

		it('returns true for schema with parameters', () => {
			expect(hasProcess({ process: [['boxA']], parameters: { boxA: 1 } })).toBe(true)
		})
	})
})

// FlowFactory tests
import FlowFactory from '../FlowFactory'
import { FlowExplicitDescription } from '../FlowBuilderI'

describe('FlowFactory', () => {
	describe('constructor', () => {
		it('creates factory with componentFactory and builder', () => {
			const mockComponentFactory = {
				create: jest.fn(),
				baseURI: 'file:///mock/'
			}
			const mockBuilder = {
				build: jest.fn()
			}

			const factory = new FlowFactory(mockComponentFactory as any, mockBuilder as any)
			expect(factory).toBeInstanceOf(FlowFactory)
		})
	})

	describe('create', () => {
		it('delegates to builder.build with schema and componentFactory', async () => {
			const mockFlow = {} as Flow
			const mockComponentFactory = {
				create: jest.fn(),
				baseURI: 'file:///mock/'
			}
			const mockBuilder = {
				build: jest.fn().mockResolvedValue(mockFlow)
			}

			const factory = new FlowFactory(mockComponentFactory as any, mockBuilder as any)
			const schema: FlowExplicitDescription = { process: [['boxA']] }

			const result = await factory.create(schema)

			expect(mockBuilder.build).toHaveBeenCalledWith(schema, mockComponentFactory, undefined)
			expect(result).toBe(mockFlow)
		})

		it('passes drain queue to builder', async () => {
			const mockFlow = {} as Flow
			const mockDrain = { push: jest.fn() } as any
			const mockComponentFactory = {
				create: jest.fn(),
				baseURI: 'file:///mock/'
			}
			const mockBuilder = {
				build: jest.fn().mockResolvedValue(mockFlow)
			}

			const factory = new FlowFactory(mockComponentFactory as any, mockBuilder as any)
			const schema: FlowExplicitDescription = { process: [['boxA']] }

			await factory.create(schema, mockDrain)

			expect(mockBuilder.build).toHaveBeenCalledWith(schema, mockComponentFactory, mockDrain)
		})

		it('returns flow from builder', async () => {
			const mockFlow = ({ process: jest.fn() } as unknown) as Flow
			const mockComponentFactory = {
				create: jest.fn(),
				baseURI: 'file:///mock/'
			}
			const mockBuilder = {
				build: jest.fn().mockResolvedValue(mockFlow)
			}

			const factory = new FlowFactory(mockComponentFactory as any, mockBuilder as any)
			const result = await factory.create({ process: [['boxA']] })

			expect(result).toBe(mockFlow)
		})
	})
})

// FlowCatalog tests
import { FlowCatalog } from '../FlowCatalog'

describe('FlowCatalog', () => {
	describe('constructor', () => {
		it('creates catalog with required dependencies', () => {
			const mockSchemaReader = {
				getFlowSchema: jest.fn()
			}
			const mockComponentFactory = {
				create: jest.fn(),
				baseURI: 'file:///mock/'
			}
			const mockBuilder = {
				build: jest.fn()
			}
			const mockVisualBuilder = {
				build: jest.fn()
			}

			const catalog = new FlowCatalog(
				mockSchemaReader as any,
				mockComponentFactory as any,
				mockBuilder as any,
				mockVisualBuilder as any
			)
			expect(catalog).toBeInstanceOf(FlowCatalog)
		})
	})

	describe('getFlow', () => {
		it('reads schema from flowSchemaReader', async () => {
			const mockSchema: FlowExplicitDescription = { process: [['boxA']] }
			const mockFlow = {} as Flow
			const mockSchemaReader = {
				getFlowSchema: jest.fn().mockResolvedValue(mockSchema)
			}
			const mockComponentFactory = {
				create: jest.fn(),
				baseURI: 'file:///mock/'
			}
			const mockBuilder = {
				build: jest.fn().mockResolvedValue(mockFlow)
			}
			const mockVisualBuilder = {
				build: jest.fn()
			}

			const catalog = new FlowCatalog(
				mockSchemaReader as any,
				mockComponentFactory as any,
				mockBuilder as any,
				mockVisualBuilder as any
			)

			await catalog.getFlow('testFlow')

			expect(mockSchemaReader.getFlowSchema).toHaveBeenCalledWith('testFlow')
		})

		it('builds flow from retrieved schema', async () => {
			const mockSchema: FlowExplicitDescription = { process: [['boxA']] }
			const mockFlow = {} as Flow
			const mockSchemaReader = {
				getFlowSchema: jest.fn().mockResolvedValue(mockSchema)
			}
			const mockComponentFactory = {
				create: jest.fn(),
				baseURI: 'file:///mock/'
			}
			const mockBuilder = {
				build: jest.fn().mockResolvedValue(mockFlow)
			}
			const mockVisualBuilder = {
				build: jest.fn()
			}

			const catalog = new FlowCatalog(
				mockSchemaReader as any,
				mockComponentFactory as any,
				mockBuilder as any,
				mockVisualBuilder as any
			)

			const result = await catalog.getFlow('testFlow')

			expect(mockBuilder.build).toHaveBeenCalledWith(mockSchema, mockComponentFactory, undefined)
			expect(result).toBe(mockFlow)
		})

		it('passes drain queue to builder', async () => {
			const mockSchema: FlowExplicitDescription = { process: [['boxA']] }
			const mockFlow = {} as Flow
			const mockDrain = { push: jest.fn() } as any
			const mockSchemaReader = {
				getFlowSchema: jest.fn().mockResolvedValue(mockSchema)
			}
			const mockComponentFactory = {
				create: jest.fn(),
				baseURI: 'file:///mock/'
			}
			const mockBuilder = {
				build: jest.fn().mockResolvedValue(mockFlow)
			}
			const mockVisualBuilder = {
				build: jest.fn()
			}

			const catalog = new FlowCatalog(
				mockSchemaReader as any,
				mockComponentFactory as any,
				mockBuilder as any,
				mockVisualBuilder as any
			)

			await catalog.getFlow('testFlow', mockDrain)

			expect(mockBuilder.build).toHaveBeenCalledWith(mockSchema, mockComponentFactory, mockDrain)
		})
	})

	describe('buildFlow', () => {
		it('builds flow directly from schema', async () => {
			const mockSchema: FlowExplicitDescription = { process: [['boxA']] }
			const mockFlow = {} as Flow
			const mockSchemaReader = {
				getFlowSchema: jest.fn()
			}
			const mockComponentFactory = {
				create: jest.fn(),
				baseURI: 'file:///mock/'
			}
			const mockBuilder = {
				build: jest.fn().mockResolvedValue(mockFlow)
			}
			const mockVisualBuilder = {
				build: jest.fn()
			}

			const catalog = new FlowCatalog(
				mockSchemaReader as any,
				mockComponentFactory as any,
				mockBuilder as any,
				mockVisualBuilder as any
			)

			const result = await catalog.buildFlow(mockSchema)

			expect(mockBuilder.build).toHaveBeenCalledWith(mockSchema, mockComponentFactory, undefined)
			expect(result).toBe(mockFlow)
			// Should not call schema reader when building directly
			expect(mockSchemaReader.getFlowSchema).not.toHaveBeenCalled()
		})

		it('passes drain queue when building directly', async () => {
			const mockSchema: FlowExplicitDescription = { process: [['boxA']] }
			const mockFlow = {} as Flow
			const mockDrain = { push: jest.fn() } as any
			const mockSchemaReader = {
				getFlowSchema: jest.fn()
			}
			const mockComponentFactory = {
				create: jest.fn(),
				baseURI: 'file:///mock/'
			}
			const mockBuilder = {
				build: jest.fn().mockResolvedValue(mockFlow)
			}
			const mockVisualBuilder = {
				build: jest.fn()
			}

			const catalog = new FlowCatalog(
				mockSchemaReader as any,
				mockComponentFactory as any,
				mockBuilder as any,
				mockVisualBuilder as any
			)

			await catalog.buildFlow(mockSchema, mockDrain)

			expect(mockBuilder.build).toHaveBeenCalledWith(mockSchema, mockComponentFactory, mockDrain)
		})
	})
})
