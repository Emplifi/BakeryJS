import {Program} from './lib/bakeryjs/Program';
import {
	boxFactory,
	BoxExecutiveDefinition,
	BoxExecutiveBatchDefinition,
} from './lib/bakeryjs/Box';
import {BoxMeta, BatchingBoxMeta} from './lib/bakeryjs/BoxI';
import {ServiceProvider} from './lib/bakeryjs/ServiceProvider';
import {MessageData} from './lib/bakeryjs/Message';

export {
	Program,
	boxFactory,
	BoxMeta,
	BatchingBoxMeta,
	BoxExecutiveDefinition,
	BoxExecutiveBatchDefinition,
	ServiceProvider,
	MessageData,
};

if (require.main === module) {
	const drainCbk = (msg: any): void => {
		console.log(`drain: ${JSON.stringify(msg, undefined, 4)}`);
	};
	new Program({}, {}).run({flow: process.argv[2]}, drainCbk);
}
