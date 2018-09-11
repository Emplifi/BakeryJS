import {Program} from '../src';
import {MessageData} from '../src/lib/bakeryjs/Message';

test('Store `Hello World!` with all default configuration', async () => {
	const program = new Program(
		{},
		{
			componentPaths: [`${__dirname}/../test-data/`],
		}
	);

	const job = {
		process: [['helloworld']],
	};

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

	expect.assertions(2);
	expect(drain).toHaveLength(1);
	expect(drain[0]).toHaveProperty('msg', 'Hello World!');
});
