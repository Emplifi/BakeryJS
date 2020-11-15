import {boxFactory} from '../Box';
import {DataMessage, Message, MessageData} from '../Message';
import {BoxMeta, BoxInterface, BatchingBoxInterface} from '../BoxI';
import {PriorityQueueI} from '../queue/PriorityQueueI';
import {ServiceProvider} from '../ServiceProvider';

describe('Box', () => {
	describe('Mapper', () => {
		const MappingBox = boxFactory(
			{
				requires: ['foo'],
				provides: ['bar'],
				emits: [],
				aggregates: false,
			} as BoxMeta,
			async function(
				serviceProvider: ServiceProvider,
				value: MessageData
			): Promise<MessageData> {
				const foo = value['foo'];
				return {bar: `${foo}!`, baz: "this value won't make it."};
			}
		);

		const setupFunction = (): {
			box: BoxInterface | BatchingBoxInterface;
			push: (arg: any) => void;
		} => {
			const outQ = {
				push: jest.fn(),
				length: 0,
				source: '__test',
				target: '__test',
			} as PriorityQueueI<Message>;

			const box = new MappingBox(
				'MapperTest',
				{} as ServiceProvider,
				outQ
			);
			return {box: box, push: outQ.push};
		};

		const scenarios = [
			(setups: {box: BoxInterface | BatchingBoxInterface; push: any}) =>
				it('Stores `provided` fields skips other.', async () => {
					const box = setups.box as BoxInterface;
					const pushMock = setups.push;
					const msg = new DataMessage({jobId: 'ttt', foo: 'hoo'});

					await box.process(msg);
					expect(pushMock).toHaveBeenCalledTimes(1);
					expect(pushMock).toHaveBeenCalledWith(msg, undefined);
					expect(
						msg.getInput(['jobId', 'foo', 'bar', 'baz'])
					).toEqual({
						jobId: 'ttt',
						foo: 'hoo',
						bar: 'hoo!',
						baz: undefined,
					});
				}),

			(setups: {box: BoxInterface | BatchingBoxInterface; push: any}) =>
				it('Emits `msg_finished` event.', async () => {
					const box = setups.box as BoxInterface;
					const msg = new DataMessage({jobId: 'ttt', foo: 'hoo'});

					expect.assertions(3);
					box.on('msg_finished', (msgsEvents: any[]) => {
						expect(msgsEvents[0]).toHaveProperty(
							'boxName',
							'MapperTest'
						);
						expect(msgsEvents[0]).toHaveProperty('messageId');
						expect(msgsEvents[0]).toHaveProperty('parentMsgId');
					});
					await box.process(msg);
				}),
		];

		scenarios.forEach((testFn) => testFn(setupFunction()));
	});

	describe('Generator', () => {
		const GeneratingBox = boxFactory(
			{
				requires: ['foo'],
				provides: ['bar'],
				emits: ['baz'],
				aggregates: false,
			} as BoxMeta,
			async function processValue(
				serviceProvider: ServiceProvider,
				value: MessageData,
				emit?: (val: MessageData[], priority?: number) => void
			): Promise<any> {
				if (!emit) {
					throw TypeError(
						'GeneratingTest box method `processValue` must be invoked with `emit`!'
					);
				}
				const foo = value['foo'];
				emit([
					{bar: `${foo}1`, baz: "this value won't make it."},
					{bar: `${foo}3`, baz: "this value won't make it."},
				]);
				emit([{bar: `${foo}2`, baz: "this value won't make it."}]);
				return;
			}
		);

		const setupFunction = (): {
			box: BoxInterface | BatchingBoxInterface;
			push: (arg: any) => void;
		} => {
			const outQ = {
				push: jest.fn(),
				length: 0,
				source: '__test',
				target: '__test',
			} as PriorityQueueI<Message>;

			const box = new GeneratingBox(
				'GeneratingTest',
				{} as ServiceProvider,
				outQ
			);
			return {box: box, push: outQ.push};
		};

		const scenarios = [
			(setups: {box: BoxInterface | BatchingBoxInterface; push: any}) =>
				it('Generates into queue', async () => {
					const box = setups.box as BoxInterface;
					const pushMock = setups.push;
					const msg = new DataMessage({jobId: 'ggg', foo: 'hoo'});

					await box.process(msg);

					expect(pushMock).toHaveBeenCalledTimes(2);
					expect(
						pushMock.mock.calls[0][0][0].getInput([
							'foo',
							'bar',
							'baz',
						])
					).toEqual({
						foo: 'hoo',
						bar: 'hoo1',
						baz: undefined,
					});
					expect(
						pushMock.mock.calls[0][0][1].getInput([
							'foo',
							'bar',
							'baz',
						])
					).toEqual({
						foo: 'hoo',
						bar: 'hoo3',
						baz: undefined,
					});
					expect(
						pushMock.mock.calls[1][0][0].getInput([
							'foo',
							'bar',
							'baz',
						])
					).toEqual({
						foo: 'hoo',
						bar: 'hoo2',
						baz: undefined,
					});
				}),

			(setups: {box: BoxInterface | BatchingBoxInterface; push: any}) =>
				it('emits event for each emitted message', async () => {
					const box = setups.box as BoxInterface;
					const msg = new DataMessage({
						jobId: 'ggg',
						foo: 'nee',
					});

					expect.assertions(9);
					box.on('msg_finished', (msgs: any[]) => {
						msgs.forEach((m) => {
							expect(m).toHaveProperty(
								'boxName',
								'GeneratingTest'
							);
							expect(m).toHaveProperty('parentMsgId', msg.id);
							expect(m).toHaveProperty('messageId');
						});
					});
					await box.process(msg);
				}),
		];

		scenarios.forEach((testFn) => testFn(setupFunction()));
	});
});
