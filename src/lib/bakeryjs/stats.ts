import assert from 'assert';
import {EventEmitter} from 'events';
import {AQueue} from './queue/MemoryPriorityQueue';
import Timer = NodeJS.Timer;

const STATS_SAMPLING_MS = 900;

// TODO: Ugly pattern -- EventEmitter should emits events about changes of internal state.
// If every push for each Message and each queue emits a message, will it overwhelm the nodejs system?
/**
 * Events emitted:
 * TODO: flow-related:
 *  - 'sent', timestamp, source, target, batchSize
 *  - 'queue_in', {boxName: string, batchSize: number}
 *  - 'queue_stats', {boxName: string, size: number}
 *  (end of flow-related)
 *  - 'box_timing', {boxName: string, duration: number}
 */
const eventEmitter = new EventEmitter();

function qTrace(statsd: boolean = false): MethodDecorator {
	return function(
		target: any,
		property: string | symbol,
		descriptor: PropertyDescriptor
	): void {
		assert(property === 'push', 'Queue push decorator not on push!');

		const originValue = descriptor.value;
		descriptor.value = function(...argsList: any[]) {
			const src = (this as any).source;
			const tgt = (this as any).target;
			const batchSize: number =
				// TODO: fragile way of detecting T[] vs T
				// If Message is subclass of T?
				Array.isArray(argsList[0]) ? argsList[0].length : 1;

			if (src && tgt) {
				eventEmitter.emit(
					'sent',
					Date.now(),
					(this as any).source,
					(this as any).target,
					batchSize
				);
			}

			if (statsd) {
				eventEmitter.emit('queue_in', {
					boxName: (this as any).target,
					batchSize: batchSize,
				});
			}
			return originValue.apply(this as any, argsList);
		};
	};
}

function sampleStats<T extends {new (...args: any[]): AQueue<any>}>(
	constr: T
): T {
	return class extends constr {
		private samplingTimer: Timer;

		public constructor(...args: any[]) {
			super(...args);
			this.samplingTimer = setInterval(
				() =>
					eventEmitter.emit('queue_stats', {
						boxName: (this as any).target,
						size: this.length,
					}),
				STATS_SAMPLING_MS
			);
			this.samplingTimer.unref();
			this.queue.on('task_finish', (_: any, _2: any, stats: any) =>
				eventEmitter.emit('box_timing', {
					boxName: this.target,
					duration: stats.elapsed,
				})
			);
		}
	};
}

export {eventEmitter, qTrace, sampleStats};
