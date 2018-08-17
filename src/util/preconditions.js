'use strict';

const _ = require('lodash');

exports.notNil = value => {
    if (_.isNil(value)) {
        throw new TypeError(`Precondition failed: got ${value}`);
    }

    return value;
};

exports.isNumber = value => {
    if (typeof value !== 'number') {
        throw new TypeError(`Precondition failed: expected number got ${value}`);
    }

    return value;
};

exports.isBoolean = value => {
    if (typeof value !== 'boolean') {
        throw new TypeError(`Precondition failed: expected boolean got ${value}`);
    }

    return value;
};

exports.nonEmptyArray = (value, length) => {
    if (!Array.isArray(value) || !value.length) {
        throw new TypeError(`Precondition failed: expected non-empty array, got: ${value}`);
    }

    if (length !== undefined && value.length !== length) {
        throw new TypeError(`Precondition failed: expected array to be of length ${length}, got: ${value.length}`);
    }

    return value;
};

exports.notIn = (value, property) => {
    if (_.hasIn(value, property)) {
        throw new TypeError(`Precondition failed: expected object not to contain ${property}, got: ${value}`);
    }

    return value;
};
