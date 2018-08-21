'use strict';

const config = require('../config');
const log = require('./log');

const base = require('request-promise').defaults({
    timeout: config.requestTimeout
});

function wrap (request) {
    const wrapper = options => {
        log.debug({uri: options.uri, method: options.method}, 'outbound HTTP request');
        return request(options).catch(e => {
            e.options = options;
            throw e;
        });
    };

    wrapper.unwrap = () => request;
    wrapper.defaults = opts => wrap(request.defaults(opts));

    return wrapper;
}

/*
 * Wraps request to provide better debugging (include request opts with the error object)
 */
exports.run = wrap(base);
