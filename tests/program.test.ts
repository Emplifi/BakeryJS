import * as VError from 'verror';
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

	program.run((job as any) as FlowDescription).catch((err) => {
		expect(err).toBeInstanceOf(VError);
		expect(err.name).toEqual('BoxParametersValidationError');
	});
});

test('Validation error for invalid job', () => {
	const job = {
		process: 'bad value',
	};

	expect(() => program.run((job as any) as FlowDescription)).toThrowError();
});
