'use strict';

const _ = require('lodash');
const P = require('bluebird');

exports.compose = (...fns) => (...args) => fns.reduce((result, f) => f(result), ...args);
exports.composeAsync = (...fns) => (...args) => fns.reduce((result, f) => {
    if (!_.isFunction(result.then)) {
        result = P.resolve(result);
    }

    return result.then(f);
}, ...args);
