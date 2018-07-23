import {Box} from '../../../src/lib/bakeryjs/Box';
import {
	DataMessage,
	Message,
	MessageData,
	SentinelMessage,
} from '../../../src/lib/bakeryjs/Message';
import {BoxMeta} from './BoxI';
import {PriorityQueueI} from './queue/PriorityQueueI';

describe('Box', () => {
	describe('Mapper', () => {
		class MappingBox extends Box {
			public constructor(output: PriorityQueueI<Message>) {
				super(
					'MapperTest',
					{
						requires: ['foo'],
						provides: ['bar'],
						emits: [],
						aggregates: false,
					} as BoxMeta,
					output
				);
			}
			protected async processValue(
				value: MessageData
			): Promise<MessageData> {
				const foo = value['foo'];
				return {bar: `${foo}!`, baz: "this value won't make it."};
			}
		}

		const setupFunction = (): {
			box: Box;
			push: (arg: any) => void;
		} => {
			const outQ = {
				push: jest.fn(),
			} as PriorityQueueI<Message>;

			const box = new MappingBox(outQ);
			return {box: box, push: outQ.push};
		};

		const scenarios = [
			(setups: {box: Box; push: any}) =>
				it('Stores `provided` fields skips other.', async () => {
					const box: Box = setups.box;
					const pushMock = setups.push;
					const msg = new DataMessage({jobId: 'ttt', foo: 'hoo'});

					await box.process(msg);
					expect.assertions(3);
					expect(pushMock).toHaveBeenCalledTimes(1);
					expect(pushMock).toHaveBeenCalledWith(msg);
					expect(
						msg.getInput(['jobId', 'foo', 'bar', 'baz'])
					).toEqual({
						jobId: 'ttt',
						foo: 'hoo',
						bar: 'hoo!',
						baz: undefined,
					});
				}),

			(setups: {box: Box; push: any}) =>
				it('Sentinel value is passed.', async () => {
					const box: Box = setups.box;
					const pushMock = setups.push;
					const parMsg = new DataMessage({jobId: '111'});
					const msg = new SentinelMessage(
						new Error('Sample of possible values.'),
						parMsg
					);

					await box.process(msg);
					expect.assertions(4);
					expect(pushMock).toHaveBeenCalledWith(msg);
					expect(pushMock).toHaveBeenCalledTimes(1);
					expect(msg.finished).toEqual(true);
					expect(msg.data).toEqual(
						new Error('Sample of possible values.')
					);
				}),
		];

		scenarios.forEach((testFn) => testFn(setupFunction()));
	});

	describe('Generator', () => {
		class GeneratingBox extends Box {
			public constructor(output: PriorityQueueI<Message>) {
				super(
					'GeneratingTest',
					{
						requires: ['foo'],
						provides: ['bar'],
						emits: ['baz'],
						aggregates: false,
					} as BoxMeta,
					output
				);
			}
			protected async processValue(
				value: MessageData,
				emit: (val: MessageData) => void
			): Promise<any> {
				const foo = value['foo'];
				emit({bar: `${foo}1`, baz: "this value won't make it."});
				emit({bar: `${foo}2`, baz: "this value won't make it."});
				return;
			}
		}

		const setupFunction = (): {
			box: Box;
			push: (arg: any) => void;
		} => {
			const outQ = {
				push: jest.fn(),
			} as PriorityQueueI<Message>;

			const box = new GeneratingBox(outQ);
			return {box: box, push: outQ.push};
		};

		const scenarios = [
			(setups: {box: Box; push: any}) =>
				it('Generates into queue', async () => {
					const box = setups.box;
					const pushMock = setups.push;
					const msg = new DataMessage({jobId: 'ggg', foo: 'hoo'});

					await box.process(msg);

					expect.assertions(5);
					expect(pushMock).toHaveBeenCalledTimes(3);
					expect(
						pushMock.mock.calls[0][0].getInput([
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
						pushMock.mock.calls[1][0].getInput([
							'foo',
							'bar',
							'baz',
						])
					).toEqual({
						foo: 'hoo',
						bar: 'hoo2',
						baz: undefined,
					});
					expect(pushMock.mock.calls[2][0].finished).toEqual(true);
					expect(pushMock.mock.calls[2][0].data).toBe(undefined);
				}),

			(setups: {box: Box; push: any}) =>
				it('passes sentinel Message', async () => {
					const box = setups.box;
					const pushMock = setups.push;
					const parentMsg = new DataMessage({
						jobId: 'ggg',
						foo: 'nee',
					});
					const msg = new SentinelMessage(5, parentMsg);

					await box.process(msg);
					expect.assertions(2);
					expect(pushMock).toHaveBeenCalledTimes(1);
					expect(pushMock).toHaveBeenCalledWith(msg);
				}),
		];

		scenarios.forEach((testFn) => testFn(setupFunction()));
	});
});
