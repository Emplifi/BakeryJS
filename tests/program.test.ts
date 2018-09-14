import {Program} from '../src';
import {MessageData} from '../src/lib/bakeryjs/Message';

const program = new Program(
	{},
	{
		componentPaths: [`${__dirname}/../test-data/`],
	}
);
program.on('sent', (timestamp, source, target) => {
	console.log(`${new Date(timestamp)} Sent: ${source} --> ${target}`);
});

test('Store `Hello World!` with all default configuration', async () => {
	const job = {
		process: [['helloworld']],
	};

	const transitions: any[] = [];
	program.on('sent', (timestamp, src, tgt) =>
		transitions.push({from: src, to: tgt})
	);

	const drain: MessageData[] = [];
	// TODO: (idea1) How the hell are we going to notice that all is done?
	// 1.  I must have a generator on the top level (and then I have a SentinelMessage)
	// 2.  Have some awkward event "All queues are empty"?
	await new Promise((resolve) => {
		program.run(job, (msg: MessageData) => {
			drain.push(msg);
			resolve();
		});
	});

	expect.assertions(3);
	expect(drain).toHaveLength(1);
	expect(drain[0]).toHaveProperty('msg', 'Hello World!');
	expect(transitions).toContainEqual({from: '_root_', to: 'helloworld'});
});

test('Store `Hello World! with dependencies` with all default configuration', async () => {
	const transitions: any[] = [];
	program.on('sent', (timestamp, src, tgt) =>
		transitions.push({from: src, to: tgt})
	);

	const job = {
		process: [['helloworld'], ['wordcount', 'punctcount'], ['checksum']],
	};

	const drain: MessageData[] = [];
	// TODO: (idea1) How the hell are we going to notice that all is done?
	// 1.  I must have a generator on the top level (and then I have a SentinelMessage)
	// 2.  Have some awkward event "All queues are empty/idle"?
	await new Promise((resolve) => {
		program.run(job, (msg: MessageData) => {
			drain.push(msg);
			resolve();
		});
	});

	expect.assertions(9);
	expect(drain).toHaveLength(1);
	expect(drain[0]).toHaveProperty('msg', 'Hello World!');
	expect(drain[0]).toHaveProperty('words', 3);
	expect(drain[0]).toHaveProperty('punct', 3);

	expect(transitions).toContainEqual({from: '_root_', to: 'helloworld'});
	expect(transitions).toContainEqual({from: 'helloworld', to: 'punctcount'});
	expect(transitions).toContainEqual({from: 'helloworld', to: 'wordcount'});
	expect(transitions).toContainEqual({from: 'punctcount', to: 'checksum'});
	expect(transitions).toContainEqual({from: 'wordcount', to: 'checksum'});
});
