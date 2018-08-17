'use strict';

require('../test');
const preconditions = require('./preconditions');
const { InternalError } = require('../errors');

test('notNil throws error on null', () => {
    expect(() => { preconditions.notNil(null); }).toThrow(InternalError);
});

test('notNil throws error on undefined', () => {
    expect(() => { preconditions.notNil(undefined); }).toThrow(InternalError);
});

test('notNil succeedes otherwise', () => {
    expect(preconditions.notNil(3)).toEqual(3);
});

test('nonEmptyArray throws error on string', () => {
    expect(() => { preconditions.nonEmptyArray('array'); }).toThrow(InternalError);
});

test('nonEmptyArray throws error on empty array', () => {
    expect(() => { preconditions.nonEmptyArray([]); }).toThrow(InternalError);
});

test('nonEmptyArray succeeds on non-empty array', () => {
    expect(preconditions.nonEmptyArray([1, 2, 3])).toEqual([1, 2, 3]);
});
