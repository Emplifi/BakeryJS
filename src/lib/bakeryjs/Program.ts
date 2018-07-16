import {Flow} from './Flow';
import {Job} from './Job';

/**
 * - ToDo: (idea2) The Program must provide a means for collecting logs of the Boxes.
 * - ToDo: (idea2) The Program must provide a means for collecting performance/monitoring metrics.

 */
export class Program {
	public run(flow: Flow): void {
		console.log("Program run ----->");

		flow.process(new Job());

		// setTimeout(() => flow.process(new Job()),2000);
	}
}
