import {DataMessage} from '../Message';

describe('Message', () => {
	const inputTestData = [
		{
			init: {},
			requires: [],
			expected: {},
		},
		{
			init: {foo: 0, bar: 1},
			requires: ['foo'],
			expected: {foo: 0},
		},
		{
			init: {foo: 0, bar: 1},
			requires: ['baz'],
			expected: {baz: undefined},
		},
	];

	inputTestData.forEach(({init, requires, expected}, index: number) => {
		it(`returns partial data as input #${index}`, () => {
			const message = new DataMessage(init);
			const input = message.getInput(requires);
			expect(input).toEqual(expected);
		});
	});

	const outputTestData = [
		{
			init: {},
			provides: [],
			data: {},
			expected: {},
		},
		{
			init: {},
			provides: ['foo'],
			data: {foo: 0},
			expected: {foo: 0},
		},
		{
			init: {bar: 1},
			provides: ['foo'],
			data: {foo: 0},
			expected: {bar: 1, foo: 0},
		},
		{
			init: {},
			provides: ['foo'],
			data: {},
			expected: {foo: undefined},
		},
	];

	outputTestData.forEach(
		({init, provides, data, expected}, index: number) => {
			it(`saves output data to the message #${index}`, () => {
				const message = new DataMessage(init);
				message.setOutput(provides, data);
				expect(message.getInput(['foo', 'bar'])).toEqual(expected);
			});
		}
	);

	it('throws an error on rewriting existing data key by an output without any changes', () => {
		const message = new DataMessage({foo: 0, bar: 1});

		expect(() => {
			message.setOutput(['baz', 'bar'], {baz: 2, bar: 3});
		}).toThrowError(
			new Error(
				'Cannot provide some data because the message already contains following results "bar".'
			)
		);

		expect(message.getInput(['foo', 'bar', 'baz'])).toEqual({
			foo: 0,
			bar: 1,
		});
	});

	describe('Parent message', () => {
		const parentMessage = new DataMessage({foo: 1, bar: 'hello'});
		const message = parentMessage.create();

		it("message.id contains parent message's id", () => {
			expect(message.id).toEqual(
				expect.stringContaining(parentMessage.id)
			);
		});

		it('Parent data are accessible in the message data', () => {
			expect(message.getInput(['bar'])).toEqual({bar: 'hello'});
		});

		it("Write into the message doesn't touch the parent", () => {
			message.setOutput(['baz'], {baz: 'world!'});

			expect(message.getInput(['baz'])).toEqual({baz: 'world!'});
			expect(parentMessage.getInput(['baz'])).toEqual({baz: undefined});
		});
	});

	describe('Sentinel Message', () => {
		const parentMessage = new DataMessage({foo: 1, bar: 2});

		it('Sentinel with undefined return value', () => {
			const sentinel = parentMessage.createSentinel(0);

			expect(sentinel.data).toEqual(undefined);
			expect(sentinel.parent).toEqual(parentMessage);
		});

		it('Sentinel contains number of messages generated', () => {
			const sentinel = parentMessage.createSentinel(10);

			expect(sentinel.dataMessageCount).toEqual(10);
		});

		it("Sentinel contains parent's id", () => {
			const sentinel = parentMessage.createSentinel(0);
			expect(sentinel.id).toEqual(
				expect.stringContaining(parentMessage.id)
			);
		});

		it('Sentinel with return value', () => {
			const theError = new TypeError('Whoa!');
			const sentinel = parentMessage.createSentinel(0, theError);

			expect(sentinel.data).toEqual(theError);
			expect(sentinel.parent).toEqual(parentMessage);
		});
	});
});
