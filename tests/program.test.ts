import {Program, MessageData} from 'bakeryjs';
import {FlowExplicitDescription} from 'bakeryjs/FlowBuilderI';
import {FlowDescription} from 'bakeryjs/Flow';

const program = new Program(
	{},
	{
		componentPaths: [`${__dirname}/../test-data/`],
	}
);
program.on('sent', (timestamp, source, target, batchSize) => {
	console.log(
		`${new Date(timestamp)} Sent: ${source} --> ${target} (${batchSize})`
	);
});

test('Store `Hello World!` with all default configuration', async () => {
	const job = {
		process: [[{helloworld: [['print']]}]],
	};

	const transitions: any[] = [];
	program.on('sent', (timestamp, src, tgt) =>
		transitions.push({from: src, to: tgt})
	);

	const drain: MessageData[] = [];
	await program.run(job, (msg: MessageData) => drain.push(msg));

	expect(drain).toHaveLength(1);
	expect(drain[0]).toHaveProperty('msg', 'Hello World!');
	expect(transitions).toContainEqual({from: '_root_', to: 'helloworld'});
});

test('Store `Hello World! with dependencies` with all default configuration', async () => {
	const transitions: any[] = [];
	program.on('sent', (timestamp, src, tgt, batchSize) =>
		transitions.push({from: src, to: tgt, size: batchSize})
	);

	const job = {
		process: [['helloworld'], ['wordcount', 'punctcount'], ['checksum']],
	};

	const drain: MessageData[] = [];
	await program.run(job, (msg: MessageData) => drain.push(msg));

	expect(drain).toHaveLength(1);
	expect(drain[0]).toHaveProperty('msg', 'Hello World!');
	expect(drain[0]).toHaveProperty('words', 3);
	expect(drain[0]).toHaveProperty('punct', 3);

	expect(transitions).toContainEqual({
		from: '_root_',
		to: 'helloworld',
		size: 1,
	});
	expect(transitions).toContainEqual({
		from: 'helloworld',
		to: 'punctcount',
		size: 1,
	});
	expect(transitions).toContainEqual({
		from: 'helloworld',
		to: 'wordcount',
		size: 1,
	});
	expect(transitions).toContainEqual({
		from: 'punctcount',
		to: 'checksum',
		size: 1,
	});
	expect(transitions).toContainEqual({
		from: 'wordcount',
		to: 'checksum',
		size: 1,
	});
});

test('Store batching `Hello World! with dependencies` with all default configuration', async () => {
	const transitions: any[] = [];
	program.on('sent', (timestamp, src, tgt, batchSize) =>
		transitions.push({from: src, to: tgt, size: batchSize})
	);

	const job: FlowExplicitDescription = {
		process: [
			['hellobatchworld'],
			['wordbatchcount', 'punctcount'],
			['checksum'],
		],
	};

	const drain: MessageData[] = [];
	await program.run(job, (msg: MessageData) => drain.push(msg));

	expect(drain).toHaveLength(5);
	expect(drain[0]).toHaveProperty('msg', 'Hello World!');
	expect(drain[0]).toHaveProperty('words', 3);
	expect(drain[0]).toHaveProperty('punct', 3);

	expect(transitions).toContainEqual({
		from: '_root_',
		to: 'hellobatchworld',
		size: 1,
	});
	expect(transitions).toContainEqual({
		from: 'hellobatchworld',
		to: 'punctcount',
		size: 2,
	});
	expect(transitions).toContainEqual({
		from: 'hellobatchworld',
		to: 'wordbatchcount',
		size: 2,
	});
	expect(transitions).toContainEqual({
		from: 'punctcount',
		to: 'checksum',
		size: 1,
	});
	expect(transitions).toContainEqual({
		from: 'wordbatchcount',
		to: 'checksum',
		size: 3,
	});
});

test('Store batching `Hello World! with dependencies` with custom configuration', async () => {
	const transitions: any[] = [];
	program.on('sent', (timestamp, src, tgt, batchSize) =>
		transitions.push({from: src, to: tgt, size: batchSize})
	);

	const job = {
		parameters: {
			checksum: 5,
		},
		process: [
			['hellobatchworld'],
			['wordbatchcount', 'punctcount'],
			['checksum'],
		],
	};

	const drain: MessageData[] = [];
	await program.run(job, (msg: MessageData) => drain.push(msg));

	expect(drain).toHaveLength(5);
	expect(drain[0]).toHaveProperty('msg', 'Hello World!');
	expect(drain[0]).toHaveProperty('words', 3);
	expect(drain[0]).toHaveProperty('punct', 3);

	expect(transitions).toContainEqual({
		from: '_root_',
		to: 'hellobatchworld',
		size: 1,
	});
	expect(transitions).toContainEqual({
		from: 'hellobatchworld',
		to: 'punctcount',
		size: 2,
	});
	expect(transitions).toContainEqual({
		from: 'hellobatchworld',
		to: 'wordbatchcount',
		size: 2,
	});
	expect(transitions).toContainEqual({
		from: 'punctcount',
		to: 'checksum',
		size: 1,
	});
	expect(transitions).toContainEqual({
		from: 'wordbatchcount',
		to: 'checksum',
		size: 3,
	});
});

test('Store `Hello World!` with initial value', async () => {
	const job = {
		process: [['checksum']],
	};

	const transitions: any[] = [];
	program.on('sent', (timestamp, src, tgt) =>
		transitions.push({from: src, to: tgt})
	);

	const drain: MessageData[] = [];
	await program.run(job, (msg: MessageData) => drain.push(msg), {
		words: 4,
		punct: 1,
	});

	expect(drain).toHaveLength(1);
	expect(drain[0]).toHaveProperty('checksum', 1 + 4 * Math.sqrt(2));
	expect(drain[0]).toHaveProperty('words', 4);
	expect(drain[0]).toHaveProperty('punct', 1);
	expect(transitions).toContainEqual({from: '_root_', to: 'checksum'});
});

test('Fail to build flow with invalid custom configuration', async () => {
	const job = {
		parameters: {
			checksum: {invalid: 'value'},
		},
		process: [
			['hellobatchworld'],
			['wordbatchcount', 'punctcount'],
			['checksum'],
		],
	};

	await program.run((job as any) as FlowDescription).catch((err) => {
		expect(err.jse_cause.jse_cause.name).toEqual(
			'BoxParametersValidationError'
		);
	});
});

test('Validation error for invalid job', () => {
	const job = {
		process: 'bad value',
	};

	expect(() => program.run((job as any) as FlowDescription)).toThrowError();
});

describe('Program constructor', () => {
	test('creates program with empty service container', () => {
		const p = new Program({}, {componentPaths: []});
		expect(p).toBeInstanceOf(Program);
	});

	test('creates program with custom service container', () => {
		const customLogger = {
			log: jest.fn(),
			error: jest.fn(),
		};
		const p = new Program({logger: customLogger}, {componentPaths: []});
		expect(p).toBeInstanceOf(Program);
	});

	test('creates program with multiple component paths', () => {
		const p = new Program(
			{},
			{
				componentPaths: [
					`${__dirname}/../test-data/`,
					`${__dirname}/../test-data/`,
				],
			}
		);
		expect(p).toBeInstanceOf(Program);
	});
});

describe('Program.on', () => {
	test('registers event listener for sent events', async () => {
		const p = new Program(
			{},
			{componentPaths: [`${__dirname}/../test-data/`]}
		);
		const sentCallback = jest.fn();
		p.on('sent', sentCallback);

		const job = {process: [['helloworld']]};
		const drain: MessageData[] = [];
		await p.run(job, (msg: MessageData) => drain.push(msg));

		expect(sentCallback).toHaveBeenCalled();
	});

	test('registers event listener for run events', async () => {
		const p = new Program(
			{},
			{componentPaths: [`${__dirname}/../test-data/`]}
		);
		const runCallback = jest.fn();
		p.on('run', runCallback);

		const job = {process: [['helloworld']]};
		const drain: MessageData[] = [];
		await p.run(job, (msg: MessageData) => drain.push(msg));

		expect(runCallback).toHaveBeenCalled();
	});
});

describe('Program.run validation', () => {
	test('throws error for empty process array', () => {
		const job = {
			process: [],
		};

		expect(() =>
			program.run((job as any) as FlowDescription)
		).toThrowError();
	});

	test('throws error for missing process property', () => {
		const job = {
			parameters: {},
		};

		expect(() =>
			program.run((job as any) as FlowDescription)
		).toThrowError();
	});

	test('throws error for invalid nested structure', () => {
		const job = {
			process: [['valid'], 'invalid'],
		};

		expect(() =>
			program.run((job as any) as FlowDescription)
		).toThrowError();
	});
});

describe('Program.run with drain callback', () => {
	test('calls drain callback for each output message', async () => {
		const drainCallback = jest.fn();
		const job = {process: [['helloworld']]};

		await program.run(job, drainCallback);

		expect(drainCallback).toHaveBeenCalledTimes(1);
		expect(drainCallback).toHaveBeenCalledWith(
			expect.objectContaining({msg: 'Hello World!'})
		);
	});

	test('runs without drain callback', async () => {
		const job = {process: [['helloworld']]};

		// Should not throw
		await expect(program.run(job)).resolves.toBeUndefined();
	});
});

describe('Program.runFlow', () => {
	test('processes job with initial value', async () => {
		const drain: MessageData[] = [];
		const job = {process: [['checksum']]};

		await program.run(job, (msg: MessageData) => drain.push(msg), {
			words: 10,
			punct: 5,
		});

		expect(drain).toHaveLength(1);
		expect(drain[0]).toHaveProperty('words', 10);
		expect(drain[0]).toHaveProperty('punct', 5);
	});
});
