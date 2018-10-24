// Program is an entry point for BakeryJS
const {Program} = require('bakeryjs');

// In its minimal form it is initialized with at least one root directory of components
const program = new Program(
	// This object is a ServiceProvider, it is passed to each component
	// and can be used for dependency injection into components
	// (think of e.g. logger or database handler)
	{},
	// These are options to initialize the Program
	{
		componentPaths: [`${__dirname}/components/`],
	}
);

// Program is an event emitter
// 'sent' event is emitted when a message is sent between components.
// It can be used for simple tracing, as in here, or advanced instrumentations.
program.on('sent', (timestamp, source, target, batchSize) => {
	console.log(
		`${new Date(
			timestamp
		).toLocaleTimeString()} Sent: ${source} --> ${target} (${batchSize})`
	);
});

// Job describes what the Program should do.
// The program can either handle multiple incoming jobs, each with unique data flow,
// or it can be kicked-off with a single job and run indifenitely
// prettier-ignore
const job = {
	// at least process property is required; it contains a description of data flow
	// data flow description contains a sequence of arrays of components,
	// each line is run serially and components inside the array run in parallel
	process: [
		['helloworld'], // helloworld is a generator
		['wordcount', 'punctcount'], // these are processors which will run in parallel for each emitted message
		['checksum'], // this processor will run after the previous processors
	]
};

// This will start the program with your job
// The second argument is an optional 'drain' function which receives
// all resulting messages which passed through the data flow
program.run(job, (msg) => {
	console.log('Drain received a message', msg);
});
