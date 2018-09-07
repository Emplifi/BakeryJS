import {Program} from './lib/bakeryjs/Program';
import {boxFactory} from './lib/bakeryjs/Box';

export {Program, boxFactory};

if (require.main === module) {
	const drainCbk = (msg: any): void => {
		console.log(`drain: ${JSON.stringify(msg, undefined, 4)}`);
	};
	new Program({}, {}).run({flow: process.argv[2]}, drainCbk);
}
