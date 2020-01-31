import {Program} from 'bakeryjs';

test('tracingModel: One dimension completes before the other starts. TypeError: Requested key msg is missing', async () => {
	const program = new Program(
		{},
		{componentPaths: [`${__dirname}/../test-data/`]}
	);

	const job = {
		process: [
			[
				{
					hellobatchworld: [['wordbatchcountslow']],
					helloworld: [['wordcount']]
				}
			]],
	};

	await program.run(job);
});
