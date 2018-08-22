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

/*
 * Runs all the functions sequentially regardless of whether a preceeding function failed.
 * Returns an array of errors thrown by the functions (may be empty).
 */
exports.runAllSeq = (...fns) => P.reduce(fns, async (result, f) => {
    try {
        await f();
    } catch (e) {
        result.push(e);
    }

    return result;
}, []);
