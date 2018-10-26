import {MessageData} from './Message';

let jobId = 0;

export class Job {
	public readonly jobId: string;

	public constructor(jobInitialValue?: MessageData) {
		this.jobId = `${jobId++}`;
		if (jobInitialValue) {
			Object.assign(this, jobInitialValue);
		}
	}
}
