import { boxFactory } from '../Box'
import { DataMessage, Message, MessageData } from '../Message'
import { BoxMeta, BoxInterface, BatchingBoxInterface, BatchingBoxMeta } from '../BoxI'
import { PriorityQueueI } from '../queue/PriorityQueueI'
import { ServiceProvider } from '../ServiceProvider'

// Helper to create a mock ServiceProvider with a logger
function createMockServiceProvider(): ServiceProvider {
	return new ServiceProvider({
		logger: {
			log: jest.fn(),
			error: jest.fn()
		}
	})
}

// Helper to create a mock queue
function createMockQueue(): PriorityQueueI<Message> & { push: jest.Mock } {
	return {
		push: jest.fn(),
		length: 0,
		source: '__test',
		target: '__test'
	}
}

describe('Box', () => {
	describe('Mapper', () => {
		const MappingBox = boxFactory(
			{
				requires: ['foo'],
				provides: ['bar'],
				emits: [],
				aggregates: false
			} as BoxMeta,
			async function (serviceProvider: ServiceProvider, value: MessageData): Promise<MessageData> {
				const foo = value['foo']
				return { bar: `${foo}!`, baz: "this value won't make it." }
			}
		)

		const setupFunction = (): {
			box: BoxInterface | BatchingBoxInterface
			push: (arg: any) => void
		} => {
			const outQ = {
				push: jest.fn(),
				length: 0,
				source: '__test',
				target: '__test'
			} as PriorityQueueI<Message>

			const box = new MappingBox('MapperTest', {} as ServiceProvider, outQ)
			return { box: box, push: outQ.push }
		}

		const scenarios = [
			(setups: { box: BoxInterface | BatchingBoxInterface; push: any }) =>
				it('Stores `provided` fields skips other.', async () => {
					const box = setups.box as BoxInterface
					const pushMock = setups.push
					const msg = new DataMessage({ jobId: 'ttt', foo: 'hoo' })

					await box.process(msg)
					expect(pushMock).toHaveBeenCalledTimes(1)
					expect(pushMock).toHaveBeenCalledWith(msg, undefined)
					expect(msg.getInput(['jobId', 'foo', 'bar', 'baz'])).toEqual({
						jobId: 'ttt',
						foo: 'hoo',
						bar: 'hoo!',
						baz: undefined
					})
				}),

			(setups: { box: BoxInterface | BatchingBoxInterface; push: any }) =>
				it('Emits `msg_finished` event.', async () => {
					const box = setups.box as BoxInterface
					const msg = new DataMessage({ jobId: 'ttt', foo: 'hoo' })

					expect.assertions(3)
					box.on('msg_finished', (msgsEvents: any[]) => {
						expect(msgsEvents[0]).toHaveProperty('boxName', 'MapperTest')
						expect(msgsEvents[0]).toHaveProperty('messageId')
						expect(msgsEvents[0]).toHaveProperty('parentMsgId')
					})
					await box.process(msg)
				})
		]

		scenarios.forEach(testFn => testFn(setupFunction()))
	})

	describe('Generator', () => {
		const GeneratingBox = boxFactory(
			{
				requires: ['foo'],
				provides: ['bar'],
				emits: ['baz'],
				aggregates: false
			} as BoxMeta,
			async function processValue(
				serviceProvider: ServiceProvider,
				value: MessageData,
				emit?: (val: MessageData[], priority?: number) => void
			): Promise<any> {
				if (!emit) {
					throw TypeError('GeneratingTest box method `processValue` must be invoked with `emit`!')
				}
				const foo = value['foo']
				emit([
					{ bar: `${foo}1`, baz: "this value won't make it." },
					{ bar: `${foo}3`, baz: "this value won't make it." }
				])
				emit([{ bar: `${foo}2`, baz: "this value won't make it." }])
				return
			}
		)

		const setupFunction = (): {
			box: BoxInterface | BatchingBoxInterface
			push: (arg: any) => void
		} => {
			const outQ = {
				push: jest.fn(),
				length: 0,
				source: '__test',
				target: '__test'
			} as PriorityQueueI<Message>

			const box = new GeneratingBox('GeneratingTest', {} as ServiceProvider, outQ)
			return { box: box, push: outQ.push }
		}

		const scenarios = [
			(setups: { box: BoxInterface | BatchingBoxInterface; push: any }) =>
				it('Generates into queue', async () => {
					const box = setups.box as BoxInterface
					const pushMock = setups.push
					const msg = new DataMessage({ jobId: 'ggg', foo: 'hoo' })

					await box.process(msg)

					expect(pushMock).toHaveBeenCalledTimes(2)
					expect(pushMock.mock.calls[0][0][0].getInput(['foo', 'bar', 'baz'])).toEqual({
						foo: 'hoo',
						bar: 'hoo1',
						baz: undefined
					})
					expect(pushMock.mock.calls[0][0][1].getInput(['foo', 'bar', 'baz'])).toEqual({
						foo: 'hoo',
						bar: 'hoo3',
						baz: undefined
					})
					expect(pushMock.mock.calls[1][0][0].getInput(['foo', 'bar', 'baz'])).toEqual({
						foo: 'hoo',
						bar: 'hoo2',
						baz: undefined
					})
				}),

			(setups: { box: BoxInterface | BatchingBoxInterface; push: any }) =>
				it('emits event for each emitted message', async () => {
					const box = setups.box as BoxInterface
					const msg = new DataMessage({
						jobId: 'ggg',
						foo: 'nee'
					})

					expect.assertions(9)
					box.on('msg_finished', (msgs: any[]) => {
						msgs.forEach(m => {
							expect(m).toHaveProperty('boxName', 'GeneratingTest')
							expect(m).toHaveProperty('parentMsgId', msg.id)
							expect(m).toHaveProperty('messageId')
						})
					})
					await box.process(msg)
				})
		]

		scenarios.forEach(testFn => testFn(setupFunction()))
	})

	describe('Parameter Validation', () => {
		it('validates parameters against schema and provides them to serviceProvider', async () => {
			const receivedParams: any[] = []
			const BoxWithParams = boxFactory(
				{
					requires: [],
					provides: ['result'],
					emits: [],
					aggregates: false,
					parameters: {
						type: 'object',
						properties: {
							name: { type: 'string' },
							count: { type: 'number' }
						},
						required: ['name']
					}
				} as BoxMeta,
				async function (sp: ServiceProvider, _value: MessageData): Promise<MessageData> {
					receivedParams.push(sp.parameters)
					return { result: sp.parameters.name }
				}
			)

			const outQ = createMockQueue()
			const serviceProvider = createMockServiceProvider()
			// The actual constructor accepts 4 params, but the type only declares 3
			// Use type assertion to pass the 4th parameter
			const BoxClass = BoxWithParams as new (
				name: string,
				sp: ServiceProvider,
				q?: PriorityQueueI<Message>,
				params?: any
			) => BoxInterface
			const box = new BoxClass('ParamBox', serviceProvider, outQ, {
				name: 'test',
				count: 42
			})

			const msg = new DataMessage({})
			await box.process(msg)

			expect(receivedParams[0]).toEqual({ name: 'test', count: 42 })
			expect(outQ.push).toHaveBeenCalled()
		})

		it('throws BoxParametersValidationError for invalid parameters', () => {
			const BoxWithParams = boxFactory(
				{
					requires: [],
					provides: ['result'],
					emits: [],
					aggregates: false,
					parameters: {
						type: 'object',
						properties: {
							name: { type: 'string' }
						},
						required: ['name']
					}
				} as BoxMeta,
				async function (_sp: ServiceProvider, _value: MessageData): Promise<MessageData> {
					return { result: 'done' }
				}
			)

			const outQ = createMockQueue()
			const serviceProvider = createMockServiceProvider()
			const BoxClass = BoxWithParams as new (
				name: string,
				sp: ServiceProvider,
				q?: PriorityQueueI<Message>,
				params?: any
			) => BoxInterface

			// Missing required 'name' parameter
			expect(() => {
				new BoxClass('ParamBox', serviceProvider, outQ, {
					notName: 'wrong'
				})
			}).toThrow(/BoxParametersValidationError|parameters/i)
		})

		it('allows box creation without parameters when schema exists', () => {
			const BoxWithParams = boxFactory(
				{
					requires: [],
					provides: ['result'],
					emits: [],
					aggregates: false,
					parameters: {
						type: 'object',
						properties: {
							name: { type: 'string' }
						}
					}
				} as BoxMeta,
				async function (_sp: ServiceProvider, _value: MessageData): Promise<MessageData> {
					return { result: 'done' }
				}
			)

			const outQ = createMockQueue()
			const serviceProvider = createMockServiceProvider()

			// Should not throw - no parameters passed
			expect(() => {
				new BoxWithParams('ParamBox', serviceProvider, outQ)
			}).not.toThrow()
		})

		it('allows parameters when no schema defined', async () => {
			const BoxNoSchema = boxFactory(
				{
					requires: [],
					provides: ['result'],
					emits: [],
					aggregates: false
				} as BoxMeta,
				async function (_sp: ServiceProvider, _value: MessageData): Promise<MessageData> {
					return { result: 'done' }
				}
			)

			const outQ = createMockQueue()
			const serviceProvider = createMockServiceProvider()
			const BoxClass = BoxNoSchema as new (
				name: string,
				sp: ServiceProvider,
				q?: PriorityQueueI<Message>,
				params?: any
			) => BoxInterface

			// Should not throw - parameters ignored when no schema
			expect(() => {
				new BoxClass('NoSchemaBox', serviceProvider, outQ, {
					any: 'params'
				})
			}).not.toThrow()
		})
	})

	describe('BatchingBox', () => {
		const BatchingMapperBox = boxFactory(
			{
				requires: ['input'],
				provides: ['output'],
				aggregates: false,
				batch: {
					maxSize: 10,
					timeoutSeconds: 0.1
				}
			} as BatchingBoxMeta,
			async function (_sp: ServiceProvider, batch: MessageData[]): Promise<MessageData[]> {
				return batch.map(item => ({
					output: `processed_${item.input}`
				}))
			}
		)

		it('processes batch of messages correctly', async () => {
			const outQ = createMockQueue()
			const serviceProvider = createMockServiceProvider()
			const box = new BatchingMapperBox(
				'BatchMapper',
				serviceProvider,
				outQ
			) as BatchingBoxInterface

			const messages = [
				new DataMessage({ input: 'a' }),
				new DataMessage({ input: 'b' }),
				new DataMessage({ input: 'c' })
			]

			await box.process(messages)

			expect(outQ.push).toHaveBeenCalledTimes(1)
			const pushedMessages = outQ.push.mock.calls[0][0]
			expect(pushedMessages).toHaveLength(3)
			expect(pushedMessages[0].getInput(['output'])).toEqual({
				output: 'processed_a'
			})
			expect(pushedMessages[1].getInput(['output'])).toEqual({
				output: 'processed_b'
			})
			expect(pushedMessages[2].getInput(['output'])).toEqual({
				output: 'processed_c'
			})
		})

		it('skips processing for empty batch', async () => {
			const outQ = createMockQueue()
			const serviceProvider = createMockServiceProvider()
			const box = new BatchingMapperBox(
				'BatchMapper',
				serviceProvider,
				outQ
			) as BatchingBoxInterface

			await box.process([])

			expect(outQ.push).not.toHaveBeenCalled()
		})

		it('throws BatchError when accessing batch as single message', async () => {
			const BadBatchBox = boxFactory(
				{
					requires: ['input'],
					provides: ['output'],
					aggregates: false,
					batch: {
						maxSize: 10
					}
				} as BatchingBoxMeta,
				async function (_sp: ServiceProvider, batch: MessageData[]): Promise<MessageData[]> {
					// Incorrectly accessing batch property directly
					// This should trigger the Proxy trap
					void (batch as any).input
					return batch.map(() => ({ output: 'done' }))
				}
			)

			const outQ = createMockQueue()
			const serviceProvider = createMockServiceProvider()
			const box = new BadBatchBox('BadBatch', serviceProvider, outQ) as BatchingBoxInterface

			const messages = [new DataMessage({ input: 'test' })]

			// The box catches the error and logs it, returning null
			const result = await box.process(messages)
			expect(result).toBeNull()
			expect(serviceProvider.get('logger').error).toHaveBeenCalled()
		})

		it('emits msg_finished events for batch', async () => {
			const outQ = createMockQueue()
			const serviceProvider = createMockServiceProvider()
			const box = new BatchingMapperBox(
				'BatchMapper',
				serviceProvider,
				outQ
			) as BatchingBoxInterface

			const messages = [new DataMessage({ input: 'a' }), new DataMessage({ input: 'b' })]

			const msgFinishedEvents: any[] = []
			box.on('msg_finished', (events: any[]) => {
				msgFinishedEvents.push(...events)
			})

			await box.process(messages)

			expect(msgFinishedEvents).toHaveLength(2)
			msgFinishedEvents.forEach(event => {
				expect(event).toHaveProperty('boxName', 'BatchMapper')
				expect(event).toHaveProperty('messageId')
			})
		})
	})

	describe('Error Handling', () => {
		it('wraps mapper errors in BoxInvocationException', async () => {
			const ErrorBox = boxFactory(
				{
					requires: ['input'],
					provides: ['output'],
					emits: [],
					aggregates: false
				} as BoxMeta,
				async function (_sp: ServiceProvider, _value: MessageData): Promise<MessageData> {
					throw new Error('Something went wrong')
				}
			)

			const outQ = createMockQueue()
			const serviceProvider = createMockServiceProvider()
			const box = new ErrorBox('ErrorBox', serviceProvider, outQ) as BoxInterface

			const msg = new DataMessage({ input: 'test' })
			const result = await box.process(msg)

			// Box catches error, logs it, and returns null
			expect(result).toBeNull()
			expect(serviceProvider.get('logger').error).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'BoxInvocationException'
				})
			)
		})

		it('wraps generator errors in BoxInvocationException', async () => {
			const ErrorGenerator = boxFactory(
				{
					requires: ['input'],
					provides: ['output'],
					emits: ['dimension'],
					aggregates: false
				} as BoxMeta,
				async function (
					_sp: ServiceProvider,
					_value: MessageData,
					_emit: (vals: MessageData[], priority?: number) => void
				): Promise<void> {
					throw new Error('Generator failed')
				}
			)

			const outQ = createMockQueue()
			const serviceProvider = createMockServiceProvider()
			const box = new ErrorGenerator('ErrorGen', serviceProvider, outQ) as BoxInterface

			const msg = new DataMessage({ input: 'test' })
			const result = await box.process(msg)

			expect(result).toBeNull()
			expect(serviceProvider.get('logger').error).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'BoxInvocationException'
				})
			)
		})

		it('converts non-Error throws to Error in mapper', async () => {
			const StringThrowBox = boxFactory(
				{
					requires: [],
					provides: ['output'],
					emits: [],
					aggregates: false
				} as BoxMeta,
				async function (_sp: ServiceProvider, _value: MessageData): Promise<MessageData> {
					throw 'string error' // eslint-disable-line no-throw-literal
				}
			)

			const outQ = createMockQueue()
			const serviceProvider = createMockServiceProvider()
			const box = new StringThrowBox('StringThrow', serviceProvider, outQ) as BoxInterface

			const msg = new DataMessage({})
			await box.process(msg)

			expect(serviceProvider.get('logger').error).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'BoxInvocationException'
				})
			)
		})
	})

	describe('Generator Edge Cases', () => {
		it('emits generation_finished event with count', async () => {
			const CountingGenerator = boxFactory(
				{
					requires: [],
					provides: ['value'],
					emits: ['items'],
					aggregates: false
				} as BoxMeta,
				async function (
					_sp: ServiceProvider,
					_value: MessageData,
					emit: (vals: MessageData[], priority?: number) => void
				): Promise<void> {
					emit([{ value: 1 }, { value: 2 }, { value: 3 }])
					emit([{ value: 4 }])
				}
			)

			const outQ = createMockQueue()
			const serviceProvider = createMockServiceProvider()
			const box = new CountingGenerator('CountGen', serviceProvider, outQ) as BoxInterface

			const msg = new DataMessage({})
			let generationEvent: any = null
			box.on('generation_finished', (events: any[]) => {
				generationEvent = events[0]
			})

			await box.process(msg)

			expect(generationEvent).not.toBeNull()
			expect(generationEvent.boxName).toBe('CountGen')
			expect(generationEvent.generated).toBe(4)
			expect(generationEvent.messageId).toBe(msg.id)
		})

		it('handles generator with zero emissions', async () => {
			const EmptyGenerator = boxFactory(
				{
					requires: [],
					provides: [],
					emits: ['empty'],
					aggregates: false
				} as BoxMeta,
				async function (
					_sp: ServiceProvider,
					_value: MessageData,
					_emit: (vals: MessageData[], priority?: number) => void
				): Promise<void> {
					// Intentionally emit nothing
				}
			)

			const outQ = createMockQueue()
			const serviceProvider = createMockServiceProvider()
			const box = new EmptyGenerator('EmptyGen', serviceProvider, outQ) as BoxInterface

			const msg = new DataMessage({})
			let generationEvent: any = null
			box.on('generation_finished', (events: any[]) => {
				generationEvent = events[0]
			})

			const result = await box.process(msg)

			expect(result).toBe(true)
			expect(outQ.push).not.toHaveBeenCalled()
			expect(generationEvent.generated).toBe(0)
		})

		it('passes priority to queue when emitting', async () => {
			const PriorityGenerator = boxFactory(
				{
					requires: [],
					provides: ['value'],
					emits: ['items'],
					aggregates: false
				} as BoxMeta,
				async function (
					_sp: ServiceProvider,
					_value: MessageData,
					emit: (vals: MessageData[], priority?: number) => void
				): Promise<void> {
					emit([{ value: 'high' }], 1)
					emit([{ value: 'low' }], 10)
				}
			)

			const outQ = createMockQueue()
			const serviceProvider = createMockServiceProvider()
			const box = new PriorityGenerator('PriorityGen', serviceProvider, outQ) as BoxInterface

			await box.process(new DataMessage({}))

			expect(outQ.push).toHaveBeenCalledTimes(2)
			expect(outQ.push.mock.calls[0][1]).toBe(1)
			expect(outQ.push.mock.calls[1][1]).toBe(10)
		})
	})

	describe('Aggregator', () => {
		it('throws NotImplementedError for aggregator boxes', async () => {
			const AggregatorBox = boxFactory(
				{
					requires: ['input'],
					provides: ['output'],
					emits: [],
					aggregates: true
				} as BoxMeta,
				async function (_sp: ServiceProvider, _value: MessageData): Promise<MessageData> {
					return { output: 'aggregated' }
				}
			)

			const outQ = createMockQueue()
			const serviceProvider = createMockServiceProvider()
			const box = new AggregatorBox('Aggregator', serviceProvider, outQ) as BoxInterface

			const msg = new DataMessage({ input: 'test' })

			// Aggregator throws directly (not caught like mapper/generator)
			await expect(box.process(msg)).rejects.toThrow(/NotImplementedError|Aggregator/)
		})
	})

	describe('Box without queue', () => {
		it('uses noopQueue when no queue provided', async () => {
			const NoQueueBox = boxFactory(
				{
					requires: [],
					provides: ['result'],
					emits: [],
					aggregates: false
				} as BoxMeta,
				async function (_sp: ServiceProvider, _value: MessageData): Promise<MessageData> {
					return { result: 'done' }
				}
			)

			const serviceProvider = createMockServiceProvider()
			// No queue provided
			const box = new NoQueueBox('NoQueue', serviceProvider) as BoxInterface

			const msg = new DataMessage({})
			// Should not throw
			const result = await box.process(msg)
			expect(result).toBeUndefined()
		})
	})

	describe('Box metadata', () => {
		it('exposes metadata correctly', () => {
			const meta: BoxMeta = {
				requires: ['a', 'b'],
				provides: ['c', 'd'],
				emits: [],
				aggregates: false,
				concurrency: 5
			}

			const MetaBox = boxFactory(meta, async (_sp: ServiceProvider, _v: MessageData) => ({}))

			const serviceProvider = createMockServiceProvider()
			const box = new MetaBox('MetaBox', serviceProvider) as BoxInterface

			expect(box.meta).toEqual(meta)
		})

		it('exposes onClean array', () => {
			const CleanBox = boxFactory(
				{
					requires: [],
					provides: [],
					emits: [],
					aggregates: false
				} as BoxMeta,
				async (_sp: ServiceProvider, _v: MessageData) => ({})
			)

			const serviceProvider = createMockServiceProvider()
			const box = new CleanBox('CleanBox', serviceProvider) as BoxInterface

			expect(box.onClean).toBeInstanceOf(Array)
			expect(box.onClean).toHaveLength(0)
		})
	})
})
