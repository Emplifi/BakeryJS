import assert from 'assert';
import {EventEmitter} from 'events';
import Timer = NodeJS.Timer;

const STATS_SAMPLING_MS = 900;

// TODO: Ugly pattern -- EventEmitter should emits events about changes of internal state.
// If every push for each Message and each queue emits a message, will it overwhelm the nodejs system?
/**
 * Events emitted:
 *  - 'sent', timestamp, source, target
 *  - 'queue_in', {boxName: string}
 *  - 'queue_stats', {boxName: string, size: number}
 *  - 'box_timing', {boxName: string, duration: number}
 */
const eventEmitter = new EventEmitter();
// TODO: configurability of the statsd

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

function asyncTimer(
	target: any,
	property: string | symbol,
	descriptor: PropertyDescriptor
): void {
	const originalValue = descriptor.value;
	descriptor.value = function(...argsList: any[]) {
		const start = process.hrtime();
		return originalValue.apply(this as any, argsList).then((v: any) => {
			const stop = process.hrtime(start);
			eventEmitter.emit('box_timing', {
				boxName: (this as any).name,
				duration: stop[0] * 1e3 + stop[1] * 1e-6,
			});
			return v;
		});
	};
}

type hasLength = {length: number};

function sampleLength<T extends {new (...args: any[]): hasLength}>(
	constr: T
): T {
	return class extends constr {
		samplingTimer: Timer;

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
		}
	};
}

export {eventEmitter, qTrace, asyncTimer, sampleLength};
