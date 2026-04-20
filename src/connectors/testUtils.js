'use strict';

/* eslint-disable security/detect-object-injection */

const base = require('../test');
const cache = require('../cache');
const config = require('../config');

/**
 * Builds a minimal Express-like request object for connector tests.
 */
const DEFAULT_IDENTITY_B64 = Buffer.from(JSON.stringify({
    identity: {
        type: 'User',
        account_number: '12345',
        org_id: '12345',
        user: {username: 'test', is_internal: false}
    }
}), 'utf8').toString('base64');

exports.mockRequest = function (headers = {
    'x-rh-identity': DEFAULT_IDENTITY_B64,
    'x-rh-insights-request-id': 'request-id'
}, user = {
    username: 'test',
    account_number: 'test'
}, identity = {type: 'test'}) {
    return {
        headers,
        identity,
        user,
        id: headers['x-rh-insights-request-id']
    };
};

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
