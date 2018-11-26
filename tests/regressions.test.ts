import {Program} from '../src';

test('tracingModel: TypeError: Requested key msg is missing', async () => {
	const program = new Program(
		{},
		{componentPaths: [`${__dirname}/../test-data/`]}
	);

	const job = {
		process: [[{hellobatchworld: [['wordbatchcountslow']]}]],
	};

	await program.run(job);
});
