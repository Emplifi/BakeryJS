/**
 * Represents a 'sent' event emitted when messages transition between boxes
 */
export interface SentEvent {
	timestamp: number
	source: string
	target: string
	batchSize: number
}

/**
 * Represents a 'run' event emitted when a flow starts
 */
export interface RunEvent {
	timestamp: number
	flow: unknown
	job: unknown
}

/**
 * A utility class for tracking events emitted by a Program during flow execution.
 * Useful for asserting on message transitions and flow execution.
 */
export class EventTracker {
	public sentEvents: SentEvent[] = []
	public runEvents: RunEvent[] = []

	/**
	 * Callback for tracking 'sent' events.
	 * Use with program.on('sent', eventTracker.trackSent)
	 */
	public trackSent = (
		timestamp: number,
		source: string,
		target: string,
		batchSize: number
	): void => {
		this.sentEvents.push({ timestamp, source, target, batchSize })
	}

	/**
	 * Callback for tracking 'run' events.
	 * The 'run' event emits (flow, job) - we capture the timestamp ourselves
	 * Use with program.on('run', eventTracker.trackRun)
	 */
	public trackRun = (flow: unknown, job: unknown): void => {
		this.runEvents.push({ timestamp: Date.now(), flow, job })
	}

	/**
	 * Returns all source→target transitions as simple objects
	 */
	public getTransitions(): Array<{ from: string; to: string }> {
		return this.sentEvents.map(e => ({ from: e.source, to: e.target }))
	}

	/**
	 * Returns transitions to a specific target box
	 */
	public getTransitionsTo(target: string): SentEvent[] {
		return this.sentEvents.filter(e => e.target === target)
	}

	/**
	 * Returns transitions from a specific source box
	 */
	public getTransitionsFrom(source: string): SentEvent[] {
		return this.sentEvents.filter(e => e.source === source)
	}

	/**
	 * Checks if a specific transition occurred
	 */
	public hasTransition(from: string, to: string): boolean {
		return this.sentEvents.some(e => e.source === from && e.target === to)
	}

	/**
	 * Clears all tracked events
	 */
	public clear(): void {
		this.sentEvents = []
		this.runEvents = []
	}

	/**
	 * Returns the total number of sent events
	 */
	public get sentCount(): number {
		return this.sentEvents.length
	}

	/**
	 * Returns the total batch size across all sent events
	 */
	public get totalBatchSize(): number {
		return this.sentEvents.reduce((sum, e) => sum + e.batchSize, 0)
	}
}
