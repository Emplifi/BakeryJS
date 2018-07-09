let jobId = 0;

export class Job {
    readonly jobId: string;

    constructor() {
        this.jobId = `${jobId++}`;
    }
}
