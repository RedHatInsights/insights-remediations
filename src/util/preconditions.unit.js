'use strict';

require('../test');
const preconditions = require('./preconditions');

test('notNil throws error on null', () => {
    expect(() => { preconditions.notNil(null); }).toThrow(TypeError);
});

test('notNil throws error on undefined', () => {
    expect(() => { preconditions.notNil(undefined); }).toThrow(TypeError);
});

test('notNil succeedes otherwise', () => {
    expect(preconditions.notNil(3)).toEqual(3);
});

test('nonEmptyArray throws error on string', () => {
    expect(() => { preconditions.nonEmptyArray('array'); }).toThrow(TypeError);
});

test('nonEmptyArray throws error on empty array', () => {
    expect(() => { preconditions.nonEmptyArray([]); }).toThrow(TypeError);
});

test('nonEmptyArray succeeds on non-empty array', () => {
    expect(preconditions.nonEmptyArray([1, 2, 3])).toEqual([1, 2, 3]);
});
