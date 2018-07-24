'use strict';

const config = require('../config');
const request = require('request-promise').defaults({
    timeout: config.requestTimeout
});

/*
 * Wraps request to provide better debugging (include request opts with the error object)
 */
module.exports = function (uri, options) {
    return request(uri, options).catch(e => {
        e.options = (typeof uri === 'object') ? uri : options;
        throw e;
    });
};

module.exports.unwrap = () => request;
