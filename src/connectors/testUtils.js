'use strict';

/* eslint-disable security/detect-object-injection */

const base = require('../test');
const cls = require('../util/cls');
const cache = require('../cache');
const config = require('../config');

exports.mockRequest = function () {
    const request = {
        headers: {
          'x-rh-identity': 'identity',
          'x-rh-insights-request-id': 'request-id'
        },
        identity: { type: 'test' },
        user: { username: 'test', account_number: 'test' }
    }
    return request
};
//     headers = {
//     'x-rh-identity': 'identity',
//     'x-rh-insights-request-id': 'request-id'
// }, user = {
//     username: 'test',
//     account_number: 'test'
// }, identity = {type: 'test'}) {
//     base.getSandbox().stub(cls, 'getReq').returns({
//         headers,
//         identity,
//         user
//     });
// };

exports.mockCache = function () {
    const data = {};

    const simpleCache = {
        status: 'ready',

        async get (key) {
            return data[key];
        },

        async setex (key, ttl, value) {
            data[key] = value;
        },

        async del (key) {
            delete data[key];
        }
    };

    const sandbox = base.getSandbox();
    sandbox.spy(simpleCache, 'get');
    sandbox.spy(simpleCache, 'setex');
    sandbox.spy(simpleCache, 'del');

    sandbox.stub(config.redis, 'enabled').value(true);
    sandbox.stub(cache, 'get').returns(simpleCache);
    return simpleCache;
};
