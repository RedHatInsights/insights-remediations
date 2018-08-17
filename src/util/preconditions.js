'use strict';

const _ = require('lodash');
const { preconditionFailed } = require('../errors').internal;

exports.notNil = value => {
    if (_.isNil(value)) {
        throw preconditionFailed(`Precondition failed: got ${value}`);
    }

    return value;
};

exports.isNumber = value => {
    if (typeof value !== 'number') {
        throw preconditionFailed(`Precondition failed: expected number got ${value}`);
    }

    return value;
};

exports.isBoolean = value => {
    if (typeof value !== 'boolean') {
        throw preconditionFailed(`Precondition failed: expected boolean got ${value}`);
    }

    return value;
};

exports.nonEmptyArray = (value, length) => {
    if (!Array.isArray(value) || !value.length) {
        throw preconditionFailed(`Precondition failed: expected non-empty array, got: ${value}`);
    }

    if (length !== undefined && value.length !== length) {
        throw preconditionFailed(`Precondition failed: expected array to be of length ${length}, got: ${value.length}`);
    }

    return value;
};

exports.notIn = (value, property) => {
    if (_.hasIn(value, property)) {
        throw preconditionFailed(`Precondition failed: expected object not to contain ${property}, got: ${value}`);
    }

    return value;
};
