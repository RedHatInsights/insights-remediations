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

exports.nonEmptyArray = value => {
    if (!Array.isArray(value) || !value.length) {
        throw new TypeError(`Precondition failed: expected non-empty array, got: ${value}`);
    }

    return value;
};
