import {PriorityQueueI} from '../../../../../src/lib/bakeryjs/queue/PriorityQueueI';
import {
	QZip,
	tee,
} from '../../../../../src/lib/bakeryjs/builders/DAGBuilder/joinedQueue';
import {AssertionError} from 'assert';
import {DataMessage, Message} from '../../../../../src/lib/bakeryjs/Message';

describe('tee', () => {
	function getQueueMock(): PriorityQueueI<any> {
		return {push: jest.fn()};
	}

	it('Tee into 2 queues.', () => {
		const qs = [getQueueMock(), getQueueMock()];
		const input: PriorityQueueI<string> = tee<string>(...qs);
		input.push('foo');

		expect.assertions(4);
		qs.forEach((q) => {
			expect(q.push).toHaveBeenCalledTimes(1);
			expect(q.push).toHaveBeenCalledWith('foo', undefined);
		});
	});

	it('Tee into 2 queues with priority.', () => {
		const qs = [getQueueMock(), getQueueMock()];
		const input: PriorityQueueI<string> = tee<string>(...qs);
		input.push('bar', 4);

		expect.assertions(4);
		qs.forEach((q) => {
			expect(q.push).toHaveBeenCalledTimes(1);
			expect(q.push).toHaveBeenCalledWith('bar', 4);
		});
	});

	it('Tee into 0 queues throws', () => {
		expect(() => tee<string>()).toThrowError(AssertionError);
	});

	it('Push into one queue fails', () => {
		const qfail: PriorityQueueI<string> = {
			push() {
				throw new Error('Go away!');
			},
		};

		const qs = [getQueueMock(), qfail];
		const input: PriorityQueueI<string> = tee<string>(...qs);
		expect(() => input.push('Money?')).toThrowError(Error);
	});
});

describe('QZip', () => {
	it('Zip of 2 queues', () => {
		const outQ: PriorityQueueI<Message> = {push: jest.fn()};
		const zip = new QZip(outQ, 2);
		const qs: PriorityQueueI<Message>[] = zip.inputs;

		const msg = new DataMessage({foo: 'foo'});
		msg.setOutput(['bar'], {bar: 'bar'});
		qs[0].push(msg);
		msg.setOutput(['baz'], {baz: 'baz'});
		qs[1].push(msg);

		expect.assertions(2);
		expect(outQ.push).toHaveBeenCalledTimes(1);
		expect(outQ.push).toHaveBeenCalledWith(msg, undefined);
	});

	it('No output before the join', () => {
		const outQ: PriorityQueueI<Message> = {push: jest.fn()};
		const zip = new QZip(outQ, 2);
		const qs: PriorityQueueI<Message>[] = zip.inputs;

		const msg = new DataMessage({foo: 'foo'});
		msg.setOutput(['bar'], {bar: 'bar'});
		qs[0].push(msg);
		msg.setOutput(['baz'], {baz: 'baz'});

		expect(outQ.push).not.toHaveBeenCalled();
	});

	it('Zip of 2 queues with messages coming out of order', () => {
		const outQ: PriorityQueueI<Message> = {push: jest.fn()};
		const zip = new QZip(outQ, 2);
		const qs: PriorityQueueI<Message>[] = zip.inputs;

		const msg1 = new DataMessage({foo: 'foo1'});
		const msg2 = new DataMessage({foo: 'foo2'});
		const msg3 = new DataMessage({foo: 'foo3'});
		expect.assertions(6);

		qs[0].push(msg1);
		qs[0].push(msg2);
		qs[0].push(msg3);

		qs[1].push(msg2);
		expect(outQ.push).toHaveBeenCalledTimes(1);
		expect(outQ.push).toHaveBeenCalledWith(msg2, undefined);

		qs[1].push(msg3);
		expect(outQ.push).toHaveBeenCalledTimes(2);
		expect(outQ.push).toHaveBeenCalledWith(msg3, undefined);

		qs[1].push(msg1);
		expect(outQ.push).toHaveBeenCalledTimes(3);
		expect(outQ.push).toHaveBeenCalledWith(msg1, undefined);
	});

	it('Zip of 2 queues with priority', () => {
		const outQ: PriorityQueueI<Message> = {push: jest.fn()};
		const zip = new QZip(outQ, 2);
		const qs: PriorityQueueI<Message>[] = zip.inputs;

		const msg = new DataMessage({foo: 'foo'});
		msg.setOutput(['bar'], {bar: 'bar'});
		qs[0].push(msg, 2);
		msg.setOutput(['baz'], {baz: 'baz'});
		qs[1].push(msg, 1);

		expect.assertions(2);
		expect(outQ.push).toHaveBeenCalledTimes(1);
		expect(outQ.push).toHaveBeenCalledWith(msg, 2);
	});
});
