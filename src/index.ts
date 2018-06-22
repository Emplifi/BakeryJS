import { Flow } from './lib/bakeryjs/Flow';
import { FlowCatalog } from './lib/bakeryjs/FlowCatalog';
import { Program } from './lib/bakeryjs/Program';

const flows = new FlowCatalog(`${__dirname}/components/`,`${__dirname}/flows/flows.ts`);
const program = new Program();
flows.getFlow(process.argv[2])
    .then((flow: Flow) => program.run(flow));
