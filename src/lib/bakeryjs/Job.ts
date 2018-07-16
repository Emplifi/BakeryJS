let jobId = 0;

export class Job {
    public readonly jobId: string;

    public constructor() {
        this.jobId = `${jobId++}`;
    }
}
