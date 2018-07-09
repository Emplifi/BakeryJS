import {Message} from '../../../src/lib/bakeryjs/Message';

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
            const message = new Message(init);
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

    outputTestData.forEach(({init, provides, data, expected}, index: number) => {
        it(`saves output data to the message #${index}`, () => {
            const message = new Message(init);
            message.setOutput(provides, data);
            expect(message.getInput(['foo', 'bar'])).toEqual(expected);
        });
    });

    it('throws an error on rewriting existing data key by an output without any changes', () => {
        const message = new Message({foo: 0, bar: 1});
        expect(() => {
            message.setOutput(['baz', 'bar'], {baz: 2, bar: 3});
        }).toThrowError(new Error('Cannot provide some data because the message already contains following results "bar".'));
        expect(message.getInput(['foo', 'bar', 'baz'])).toEqual({foo: 0, bar: 1});
    });
});
