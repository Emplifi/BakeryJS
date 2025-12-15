import type { PriorityQueueI } from '../../../queue/PriorityQueueI'
import { QZip, Tee } from '../joinedQueue'
import { AssertionError } from 'assert'
import { DataMessage } from '../../../Message'
import type { Message } from '../../../Message'

describe('new Tee', () => {
	function getQueueMock(): PriorityQueueI<any> {
		return { push: jest.fn(), length: 0, target: '' }
	}

	it('Tee into 2 queues.', () => {
		const qs = [getQueueMock(), getQueueMock()]
		const input: PriorityQueueI<string> = new Tee<string>(...qs)
		input.push('foo')

		expect.assertions(4)
		qs.forEach(q => {
			expect(q.push).toHaveBeenCalledTimes(1)
			expect(q.push).toHaveBeenCalledWith('foo', undefined)
		})
	})

	it('Tee into 2 queues with priority.', () => {
		const qs = [getQueueMock(), getQueueMock()]
		const input: PriorityQueueI<string> = new Tee<string>(...qs)
		input.push('bar', 4)

		expect.assertions(4)
		qs.forEach(q => {
			expect(q.push).toHaveBeenCalledTimes(1)
			expect(q.push).toHaveBeenCalledWith('bar', 4)
		})
	})

	it('Tee into 0 queues throws', () => {
		expect(() => new Tee<string>()).toThrowError(AssertionError)
	})

	it('Push into one queue fails', () => {
		const qfail: PriorityQueueI<string> = {
			push() {
				throw new Error('Go away!')
			},
			length: 0,
			target: ''
		}

		const qs = [getQueueMock(), qfail]
		const input: PriorityQueueI<string> = new Tee<string>(...qs)
		expect(() => input.push('Money?')).toThrowError(Error)
	})

	it('Tee into 3 queues', () => {
		const qs = [getQueueMock(), getQueueMock(), getQueueMock()]
		const input: PriorityQueueI<string> = new Tee<string>(...qs)
		input.push('test')

		qs.forEach(q => {
			expect(q.push).toHaveBeenCalledTimes(1)
			expect(q.push).toHaveBeenCalledWith('test', undefined)
		})
	})

	it('Tee into 5 queues with priority', () => {
		const qs = [getQueueMock(), getQueueMock(), getQueueMock(), getQueueMock(), getQueueMock()]
		const input: PriorityQueueI<string> = new Tee<string>(...qs)
		input.push('data', 7)

		qs.forEach(q => {
			expect(q.push).toHaveBeenCalledTimes(1)
			expect(q.push).toHaveBeenCalledWith('data', 7)
		})
	})

	it('Tee has length of 0', () => {
		const qs = [getQueueMock(), getQueueMock()]
		const input: PriorityQueueI<string> = new Tee<string>(...qs)

		expect(input).toHaveLength(0)
	})

	it('Tee has empty target', () => {
		const qs = [getQueueMock(), getQueueMock()]
		const input: PriorityQueueI<string> = new Tee<string>(...qs)

		expect(input.target).toBe('')
	})

	it('Tee source can be set', () => {
		const qs = [getQueueMock(), getQueueMock()]
		const input = new Tee<string>(...qs)

		input.source = 'mySource'
		expect(input.source).toBe('mySource')
	})

	it('Tee into 1 queue works', () => {
		const qs = [getQueueMock()]
		const input: PriorityQueueI<string> = new Tee<string>(...qs)
		input.push('single')

		expect((qs[0] as PriorityQueueI<any>).push).toHaveBeenCalledTimes(1)
		expect((qs[0] as PriorityQueueI<any>).push).toHaveBeenCalledWith('single', undefined)
	})
})

describe('QZip', () => {
	it('Zip of 2 queues', () => {
		const outQ: PriorityQueueI<Message> = {
			push: jest.fn(),
			length: 0,
			target: ''
		}
		const zip = new QZip(outQ, 2)
		const qs = zip.inputs as PriorityQueueI<Message>[]

		const msg = new DataMessage({ foo: 'foo' })
		msg.setOutput(['bar'], { bar: 'bar' })
		;(qs[0] as PriorityQueueI<Message>).push(msg)
		msg.setOutput(['baz'], { baz: 'baz' })
		;(qs[1] as PriorityQueueI<Message>).push(msg)

		expect.assertions(2)
		expect(outQ.push).toHaveBeenCalledTimes(1)
		expect(outQ.push).toHaveBeenCalledWith(msg, undefined)
	})

	it('No output before the join', () => {
		const outQ: PriorityQueueI<Message> = {
			push: jest.fn(),
			length: 0,
			target: ''
		}
		const zip = new QZip(outQ, 2)
		const qs = zip.inputs as PriorityQueueI<Message>[]

		const msg = new DataMessage({ foo: 'foo' })
		msg.setOutput(['bar'], { bar: 'bar' })
		;(qs[0] as PriorityQueueI<Message>).push(msg)
		msg.setOutput(['baz'], { baz: 'baz' })

		expect(outQ.push).not.toHaveBeenCalled()
	})

	it('Zip of 2 queues with messages coming out of order', () => {
		const outQ: PriorityQueueI<Message> = {
			push: jest.fn(),
			length: 0,
			target: ''
		}
		const zip = new QZip(outQ, 2)
		const qs = zip.inputs as PriorityQueueI<Message>[]

		const msg1 = new DataMessage({ foo: 'foo1' })
		const msg2 = new DataMessage({ foo: 'foo2' })
		const msg3 = new DataMessage({ foo: 'foo3' })
		expect.assertions(6)
		;(qs[0] as PriorityQueueI<Message>).push(msg1)
		;(qs[0] as PriorityQueueI<Message>).push(msg2)
		;(qs[0] as PriorityQueueI<Message>).push(msg3)
		;(qs[1] as PriorityQueueI<Message>).push(msg2)
		expect(outQ.push).toHaveBeenCalledTimes(1)
		expect(outQ.push).toHaveBeenCalledWith(msg2, undefined)
		;(qs[1] as PriorityQueueI<Message>).push(msg3)
		expect(outQ.push).toHaveBeenCalledTimes(2)
		expect(outQ.push).toHaveBeenCalledWith(msg3, undefined)
		;(qs[1] as PriorityQueueI<Message>).push(msg1)
		expect(outQ.push).toHaveBeenCalledTimes(3)
		expect(outQ.push).toHaveBeenCalledWith(msg1, undefined)
	})

	it('Zip of 2 queues with priority', () => {
		const outQ: PriorityQueueI<Message> = {
			push: jest.fn(),
			length: 0,
			target: ''
		}
		const zip = new QZip(outQ, 2)
		const qs = zip.inputs as PriorityQueueI<Message>[]

		const msg = new DataMessage({ foo: 'foo' })
		msg.setOutput(['bar'], { bar: 'bar' })
		;(qs[0] as PriorityQueueI<Message>).push(msg, 2)
		msg.setOutput(['baz'], { baz: 'baz' })
		;(qs[1] as PriorityQueueI<Message>).push(msg, 1)

		expect.assertions(2)
		expect(outQ.push).toHaveBeenCalledTimes(1)
		expect(outQ.push).toHaveBeenCalledWith(msg, 2)
	})

	it('Zip of 3 queues', () => {
		const outQ: PriorityQueueI<Message> = {
			push: jest.fn(),
			length: 0,
			target: ''
		}
		const zip = new QZip(outQ, 3)
		const qs = zip.inputs as PriorityQueueI<Message>[]

		expect(qs).toHaveLength(3)

		const msg = new DataMessage({ foo: 'foo' })
		;(qs[0] as PriorityQueueI<Message>).push(msg)
		expect(outQ.push).not.toHaveBeenCalled()
		;(qs[1] as PriorityQueueI<Message>).push(msg)
		expect(outQ.push).not.toHaveBeenCalled()
		;(qs[2] as PriorityQueueI<Message>).push(msg)
		expect(outQ.push).toHaveBeenCalledTimes(1)
		expect(outQ.push).toHaveBeenCalledWith(msg, undefined)
	})

	it('Zip priority uses max across inputs', () => {
		const outQ: PriorityQueueI<Message> = {
			push: jest.fn(),
			length: 0,
			target: ''
		}
		const zip = new QZip(outQ, 3)
		const qs = zip.inputs as PriorityQueueI<Message>[]

		const msg = new DataMessage({ foo: 'foo' })
		;(qs[0] as PriorityQueueI<Message>).push(msg, 5)
		;(qs[1] as PriorityQueueI<Message>).push(msg, 10)
		;(qs[2] as PriorityQueueI<Message>).push(msg, 3)

		expect(outQ.push).toHaveBeenCalledWith(msg, 10)
	})

	it('Zip handles undefined priorities correctly', () => {
		const outQ: PriorityQueueI<Message> = {
			push: jest.fn(),
			length: 0,
			target: ''
		}
		const zip = new QZip(outQ, 2)
		const qs = zip.inputs as PriorityQueueI<Message>[]

		const msg = new DataMessage({ foo: 'foo' })
		;(qs[0] as PriorityQueueI<Message>).push(msg, undefined)
		;(qs[1] as PriorityQueueI<Message>).push(msg, 5)

		// Max of undefined and 5 should be 5
		expect(outQ.push).toHaveBeenCalledWith(msg, 5)
	})

	it('Zip tracks length correctly', () => {
		const outQ: PriorityQueueI<Message> = {
			push: jest.fn(),
			length: 0,
			target: ''
		}
		const zip = new QZip(outQ, 2)
		const qs = zip.inputs as PriorityQueueI<Message>[]

		expect(zip).toHaveLength(0)

		const msg1 = new DataMessage({ foo: 'foo1' })
		const msg2 = new DataMessage({ foo: 'foo2' })

		;(qs[0] as PriorityQueueI<Message>).push(msg1)
		expect(zip).toHaveLength(1)
		;(qs[0] as PriorityQueueI<Message>).push(msg2)
		expect(zip).toHaveLength(2)

		// Complete msg1
		;(qs[1] as PriorityQueueI<Message>).push(msg1)
		expect(zip).toHaveLength(1)

		// Complete msg2
		;(qs[1] as PriorityQueueI<Message>).push(msg2)
		expect(zip).toHaveLength(0)
	})

	it('Zip reports correct size', () => {
		const outQ: PriorityQueueI<Message> = {
			push: jest.fn(),
			length: 0,
			target: ''
		}
		const zip = new QZip(outQ, 4)

		expect(zip.size).toBe(4)
	})

	it('QZip throws when inputs < 2', () => {
		const outQ: PriorityQueueI<Message> = {
			push: jest.fn(),
			length: 0,
			target: ''
		}

		expect(() => new QZip(outQ, 1)).toThrow()
		expect(() => new QZip(outQ, 0)).toThrow()
	})

	it('QZip handles batch messages', () => {
		const outQ: PriorityQueueI<Message> = {
			push: jest.fn(),
			length: 0,
			target: ''
		}
		const zip = new QZip(outQ, 2)
		const qs = zip.inputs as PriorityQueueI<Message>[]

		const msg1 = new DataMessage({ foo: 'foo1' })
		const msg2 = new DataMessage({ foo: 'foo2' })

		// Push batch to first input
		;(qs[0] as PriorityQueueI<Message>).push([msg1, msg2])
		expect(outQ.push).not.toHaveBeenCalled()

		// Push batch to second input
		;(qs[1] as PriorityQueueI<Message>).push([msg1, msg2])
		expect(outQ.push).toHaveBeenCalledTimes(2)
	})

	it('QZip input queues have correct target', () => {
		const outQ: PriorityQueueI<Message> = {
			push: jest.fn(),
			length: 0,
			target: 'myTarget'
		}
		const zip = new QZip(outQ, 2)
		const qs = zip.inputs as PriorityQueueI<Message>[]

		expect((qs[0] as PriorityQueueI<Message>).target).toBe('myTarget')
		expect((qs[1] as PriorityQueueI<Message>).target).toBe('myTarget')
	})
})
