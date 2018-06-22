import { FlowCatalog } from "./lib/bakeryjs/FlowCatalog"
import { Program } from "./lib/bakeryjs/Program"


const flows = new FlowCatalog(__dirname+'/components/',__dirname+'/flows/flows.ts')
const program = new Program()
program.run(flows.getFlow(process.argv[2]))