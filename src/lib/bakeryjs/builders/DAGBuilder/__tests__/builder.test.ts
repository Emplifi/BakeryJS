import {DAGBuilder, ROOT_NODE} from '../builder';
import {FlowExplicitDescription} from '../../../FlowBuilderI';
import ComponentFactoryI from '../../../ComponentFactoryI';
import {PriorityQueueI} from '../../../queue/PriorityQueueI';
import {Message} from '../../../Message';
import {
	BoxInterface,
	BatchingBoxInterface,
	BoxMeta,
	BatchingBoxMeta,
} from '../../../BoxI';
import {EventEmitter} from 'events';

// Helper to create a mock BoxInterface (mapper)
function createMockMapperBox(
	name: string,
	meta?: Partial<BoxMeta>
): BoxInterface {
	const emitter = new EventEmitter();
	return ({
		name,
		meta: {
			requires: [],
			provides: [],
			emits: [],
			aggregates: false,
			...meta,
		},
		process: jest.fn().mockResolvedValue(undefined),
		on: emitter.on.bind(emitter),
		emit: emitter.emit.bind(emitter),
	} as unknown) as BoxInterface;
}

// Helper to create a mock BoxInterface (generator)
function createMockGeneratorBox(
	name: string,
	emits: string[],
	meta?: Partial<BoxMeta>
): BoxInterface {
	const emitter = new EventEmitter();
	return ({
		name,
		meta: {
			requires: [],
			provides: [],
			emits,
			aggregates: false,
			...meta,
		},
		process: jest.fn().mockResolvedValue(undefined),
		on: emitter.on.bind(emitter),
		emit: emitter.emit.bind(emitter),
	} as unknown) as BoxInterface;
}

// Helper to create a mock BatchingBoxInterface
function createMockBatchingBox(
	name: string,
	meta?: Partial<BatchingBoxMeta>
): BatchingBoxInterface {
	const emitter = new EventEmitter();
	const baseMeta: BatchingBoxMeta = {
		requires: [],
		provides: [],
		aggregates: false,
		batch: {
			maxSize: 10,
			timeoutSeconds: 0.2,
		},
	};
	return ({
		name,
		meta: {...baseMeta, ...meta},
		process: jest.fn().mockResolvedValue(undefined),
		on: emitter.on.bind(emitter),
		emit: emitter.emit.bind(emitter),
	} as unknown) as BatchingBoxInterface;
}

// Helper to create a mock ComponentFactory
type BoxCreationRecord = {
	name: string;
	queue: PriorityQueueI<Message> | undefined;
	parameters: any;
};

function createMockComponentFactory(
	boxRegistry: Map<
		string,
		(
			queue?: PriorityQueueI<Message>,
			params?: any
		) => BoxInterface | BatchingBoxInterface
	>
): ComponentFactoryI & {creationLog: BoxCreationRecord[]} {
	const creationLog: BoxCreationRecord[] = [];

	return {
		creationLog,
		async create(
			name: string,
			queue?: PriorityQueueI<Message>,
			parameters?: any
		): Promise<BoxInterface | BatchingBoxInterface> {
			creationLog.push({name, queue, parameters});
			const boxCreator = boxRegistry.get(name);
			if (!boxCreator) {
				throw new Error(`Box ${name} not found in registry`);
			}
			return boxCreator(queue, parameters);
		},
	};
}

// Helper to create a mock drain queue
function createMockDrainQueue(): PriorityQueueI<Message> & {push: jest.Mock} {
	return {
		push: jest.fn(),
		length: 0,
		target: '__drain__',
	};
}

describe('DAGBuilder', () => {
	let builder: DAGBuilder;

	beforeEach(() => {
		builder = new DAGBuilder();
	});

	describe('ROOT_NODE constant', () => {
		it('should be "_root_"', () => {
			expect(ROOT_NODE).toBe('_root_');
		});
	});

	describe('Simple linear flow (A → B → C)', () => {
		it('creates boxes in correct topological order', async () => {
			const boxRegistry = new Map<string, () => BoxInterface>([
				['boxA', () => createMockMapperBox('boxA')],
				['boxB', () => createMockMapperBox('boxB')],
				['boxC', () => createMockMapperBox('boxC')],
			]);

			const factory = createMockComponentFactory(boxRegistry);
			const drain = createMockDrainQueue();

			const schema: FlowExplicitDescription = {
				process: [['boxA'], ['boxB'], ['boxC']],
			};

			await builder.build(schema, factory, drain);

			// Verify all boxes were created
			expect(factory.creationLog).toHaveLength(3);

			// Boxes should be created in topological order (last first due to reversed edges)
			// boxC depends on boxB, boxB depends on boxA
			// So creation order should be: boxC, boxB, boxA
			expect(factory.creationLog[0].name).toBe('boxC');
			expect(factory.creationLog[1].name).toBe('boxB');
			expect(factory.creationLog[2].name).toBe('boxA');
		});

		it('terminal box receives drain queue', async () => {
			const boxRegistry = new Map<string, () => BoxInterface>([
				['boxA', () => createMockMapperBox('boxA')],
				['boxB', () => createMockMapperBox('boxB')],
			]);

			const factory = createMockComponentFactory(boxRegistry);
			const drain = createMockDrainQueue();

			const schema: FlowExplicitDescription = {
				process: [['boxA'], ['boxB']],
			};

			await builder.build(schema, factory, drain);

			// boxB is terminal (last box), should receive drain queue
			expect(factory.creationLog[0].name).toBe('boxB');
			expect(factory.creationLog[0].queue).toBe(drain);
		});

		it('returns a Flow with input queue', async () => {
			const boxRegistry = new Map<string, () => BoxInterface>([
				['boxA', () => createMockMapperBox('boxA')],
			]);

			const factory = createMockComponentFactory(boxRegistry);
			const drain = createMockDrainQueue();

			const schema: FlowExplicitDescription = {
				process: [['boxA']],
			};

			const flow = await builder.build(schema, factory, drain);

			// Flow should have a process method (indicating it's a valid Flow)
			expect(flow).toBeDefined();
			expect(typeof flow.process).toBe('function');
		});
	});

	describe('Parallel boxes at same level (fanout)', () => {
		it('creates boxes that run in parallel', async () => {
			const boxRegistry = new Map<string, () => BoxInterface>([
				['boxA', () => createMockMapperBox('boxA')],
				['boxB', () => createMockMapperBox('boxB')],
				['boxC', () => createMockMapperBox('boxC')],
			]);

			const factory = createMockComponentFactory(boxRegistry);
			const drain = createMockDrainQueue();

			// boxA -> [boxB, boxC] (parallel)
			const schema: FlowExplicitDescription = {
				process: [['boxA'], ['boxB', 'boxC']],
			};

			await builder.build(schema, factory, drain);

			// All boxes should be created
			expect(factory.creationLog).toHaveLength(3);

			// Both boxB and boxC are terminal boxes
			const terminalBoxes = factory.creationLog.filter(
				(r) => r.queue === drain
			);
			expect(terminalBoxes).toHaveLength(2);
		});
	});

	describe('Parameters passing', () => {
		it('passes parameters to boxes', async () => {
			const boxRegistry = new Map<string, () => BoxInterface>([
				['boxA', () => createMockMapperBox('boxA')],
			]);

			const factory = createMockComponentFactory(boxRegistry);
			const drain = createMockDrainQueue();

			const schema: FlowExplicitDescription = {
				process: [['boxA']],
				parameters: {
					boxA: {customParam: 'value'},
				},
			};

			await builder.build(schema, factory, drain);

			expect(factory.creationLog[0].parameters).toEqual({
				customParam: 'value',
			});
		});

		it('does not pass parameters when not specified', async () => {
			const boxRegistry = new Map<string, () => BoxInterface>([
				['boxA', () => createMockMapperBox('boxA')],
			]);

			const factory = createMockComponentFactory(boxRegistry);
			const drain = createMockDrainQueue();

			const schema: FlowExplicitDescription = {
				process: [['boxA']],
			};

			await builder.build(schema, factory, drain);

			expect(factory.creationLog[0].parameters).toBeUndefined();
		});
	});

	describe('Generator with sub-flow', () => {
		it('creates generator and its sub-flow boxes', async () => {
			const boxRegistry = new Map<string, () => BoxInterface>([
				[
					'generator',
					() => createMockGeneratorBox('generator', ['dim1']),
				],
				['processor', () => createMockMapperBox('processor')],
			]);

			const factory = createMockComponentFactory(boxRegistry);
			const drain = createMockDrainQueue();

			// generator -> processor (sub-flow)
			const schema: FlowExplicitDescription = {
				process: [[{generator: [['processor']]}]],
			};

			await builder.build(schema, factory, drain);

			// Both boxes should be created
			expect(factory.creationLog).toHaveLength(2);

			// Verify both boxes exist in creation log
			const boxNames = factory.creationLog.map((r) => r.name);
			expect(boxNames).toContain('generator');
			expect(boxNames).toContain('processor');
		});

		it('creates nested sub-flows correctly', async () => {
			const boxRegistry = new Map<string, () => BoxInterface>([
				['gen1', () => createMockGeneratorBox('gen1', ['dim1'])],
				['gen2', () => createMockGeneratorBox('gen2', ['dim2'])],
				['leaf', () => createMockMapperBox('leaf')],
			]);

			const factory = createMockComponentFactory(boxRegistry);
			const drain = createMockDrainQueue();

			// gen1 -> gen2 -> leaf (deeply nested)
			const schema: FlowExplicitDescription = {
				process: [[{gen1: [[{gen2: [['leaf']]}]]}]],
			};

			await builder.build(schema, factory, drain);

			// All boxes should be created
			expect(factory.creationLog).toHaveLength(3);

			const boxNames = factory.creationLog.map((r) => r.name);
			expect(boxNames).toContain('gen1');
			expect(boxNames).toContain('gen2');
			expect(boxNames).toContain('leaf');
		});
	});

	describe('Batching boxes', () => {
		it('creates batching box with batch queue', async () => {
			const boxRegistry = new Map<string, () => BatchingBoxInterface>([
				[
					'batchBox',
					() =>
						createMockBatchingBox('batchBox', {
							batch: {maxSize: 5, timeoutSeconds: 0.5},
						}),
				],
			]);

			const factory = createMockComponentFactory(boxRegistry);
			const drain = createMockDrainQueue();

			const schema: FlowExplicitDescription = {
				process: [['batchBox']],
			};

			await builder.build(schema, factory, drain);

			expect(factory.creationLog).toHaveLength(1);
			expect(factory.creationLog[0].name).toBe('batchBox');
		});
	});

	describe('Error handling', () => {
		it('throws when box is not found in factory', async () => {
			const boxRegistry = new Map<string, () => BoxInterface>();

			const factory = createMockComponentFactory(boxRegistry);
			const drain = createMockDrainQueue();

			const schema: FlowExplicitDescription = {
				process: [['nonExistentBox']],
			};

			await expect(builder.build(schema, factory, drain)).rejects.toThrow(
				'Box nonExistentBox not found in registry'
			);
		});
	});

	describe('Join scenario ([B, C] → D)', () => {
		it('creates boxes with QZip for join', async () => {
			const boxRegistry = new Map<string, () => BoxInterface>([
				['boxA', () => createMockMapperBox('boxA')],
				['boxB', () => createMockMapperBox('boxB')],
				['boxC', () => createMockMapperBox('boxC')],
				['boxD', () => createMockMapperBox('boxD')],
			]);

			const factory = createMockComponentFactory(boxRegistry);
			const drain = createMockDrainQueue();

			// boxA -> [boxB, boxC] -> boxD
			// boxD receives from both boxB and boxC, requiring QZip
			const schema: FlowExplicitDescription = {
				process: [['boxA'], ['boxB', 'boxC'], ['boxD']],
			};

			await builder.build(schema, factory, drain);

			// All 4 boxes should be created
			expect(factory.creationLog).toHaveLength(4);

			// Verify box creation order (topological)
			const boxNames = factory.creationLog.map((r) => r.name);
			expect(boxNames).toContain('boxA');
			expect(boxNames).toContain('boxB');
			expect(boxNames).toContain('boxC');
			expect(boxNames).toContain('boxD');

			// boxD should be created first (terminal)
			expect(factory.creationLog[0].name).toBe('boxD');
			expect(factory.creationLog[0].queue).toBe(drain);
		});
	});

	describe('Multiple generators in parallel', () => {
		it('creates parallel generators correctly', async () => {
			const boxRegistry = new Map<string, () => BoxInterface>([
				['gen1', () => createMockGeneratorBox('gen1', ['dim1'])],
				['gen2', () => createMockGeneratorBox('gen2', ['dim2'])],
				['proc1', () => createMockMapperBox('proc1')],
				['proc2', () => createMockMapperBox('proc2')],
			]);

			const factory = createMockComponentFactory(boxRegistry);
			const drain = createMockDrainQueue();

			// Two generators in parallel, each with its own sub-flow
			const schema: FlowExplicitDescription = {
				process: [[{gen1: [['proc1']]}, {gen2: [['proc2']]}]],
			};

			await builder.build(schema, factory, drain);

			// All 4 boxes should be created
			expect(factory.creationLog).toHaveLength(4);

			const boxNames = factory.creationLog.map((r) => r.name);
			expect(boxNames).toContain('gen1');
			expect(boxNames).toContain('gen2');
			expect(boxNames).toContain('proc1');
			expect(boxNames).toContain('proc2');
		});
	});

	describe('Empty and minimal flows', () => {
		it('handles single box flow', async () => {
			const boxRegistry = new Map<string, () => BoxInterface>([
				['onlyBox', () => createMockMapperBox('onlyBox')],
			]);

			const factory = createMockComponentFactory(boxRegistry);
			const drain = createMockDrainQueue();

			const schema: FlowExplicitDescription = {
				process: [['onlyBox']],
			};

			const flow = await builder.build(schema, factory, drain);

			expect(factory.creationLog).toHaveLength(1);
			expect(factory.creationLog[0].name).toBe('onlyBox');
			expect(factory.creationLog[0].queue).toBe(drain);
			expect(flow).toBeDefined();
		});
	});
});
