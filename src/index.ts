import { Program } from './lib/bakeryjs/Program'
import { boxFactory } from './lib/bakeryjs/Box'
import type { BoxExecutiveDefinition, BoxExecutiveBatchDefinition } from './lib/bakeryjs/Box'
import type { BoxMeta, BatchingBoxMeta } from './lib/bakeryjs/BoxI'
import { ServiceProvider } from './lib/bakeryjs/ServiceProvider'
import type { MessageData } from './lib/bakeryjs/Message'

export {
	Program,
	boxFactory,
	BoxMeta,
	BatchingBoxMeta,
	BoxExecutiveDefinition,
	BoxExecutiveBatchDefinition,
	ServiceProvider,
	MessageData
}

if (require.main === module) {
	const drainCbk = (msg: any): void => {
		console.log(`drain: ${JSON.stringify(msg, undefined, 4)}`)
	}
	const flowArg = process.argv[2]
	if (flowArg) {
		new Program({}, {}).run({ flow: flowArg }, drainCbk)
	} else {
		console.error('Usage: bakeryjs <flow>')
		process.exit(1)
	}
}
