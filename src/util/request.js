'use strict';

const config = require('../config');
const log = require('./log');
const http = require('http');

const base = require('request-promise').defaults({
    timeout: config.requestTimeout
});

function getStatus (result) {
    if (result instanceof Error) {
        return result.message;
    }

    if (result instanceof http.IncomingMessage) {
        return result.statusCode;
    }

    return 'error';
}

const logger = (options) => {
    const before = new Date();
    return result => {
        log.debug({
            uri: options.uri,
            method: options.method,
            responseTime: new Date() - before,
            status: getStatus(result)
        }, 'outbound HTTP request finished');
    };
};

function wrap (request) {
    const wrapper = options => {
        log.debug({uri: options.uri, method: options.method}, 'outbound HTTP request');
        const finished = logger(options);
        return request(options).catch(e => {
            e.options = options;
            throw e;
        })
        .tap(finished)
        .tapCatch(finished);
    };

    wrapper.unwrap = () => request;
    wrapper.defaults = opts => wrap(request.defaults(opts));

    return wrapper;
}

/*
 * Wraps request to provide better debugging (include request opts with the error object)
 */
exports.run = wrap(base);
