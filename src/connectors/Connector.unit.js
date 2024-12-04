'use strict';

const vmaas = require('./vmaas/vmaas');
const base = require('../test');
const http = require('./http');
const StatusCodeError = require('./StatusCodeError');
const errors = require('../errors');
const { mockRequest } = require('./testUtils');

const REQ = {
    headers: {
        'x-rh-identity': 'identity',
        'x-rh-insights-request-id': 'request-id'
    },
    identity: { type: 'test' },
    user: { username: 'test', account_number: 'test' }
};

describe('Connector', function () {

    test('wraps errors', async function () {
        mockRequest();
        base.getSandbox().stub(http, 'request').rejects(new StatusCodeError(500));
        await expect(vmaas.getCve(REQ, 'id')).rejects.toThrow(errors.DependencyError);
    });
});
