'use strict';

const _ = require('lodash');

exports.notNil = value => {
    if (_.isNil(value)) {
        throw new TypeError(`Precondition failed: got ${value}`);
    }

    return value;
};
