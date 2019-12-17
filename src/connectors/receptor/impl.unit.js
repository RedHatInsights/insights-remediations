'use strict';

const impl = require('./impl');
const base = require('../../test');
const Connector = require('../Connector');
const { mockRequest } = require('../testUtils');
const request = require('../../util/request');
const errors = require('../../errors');

describe('receptor impl', function () {
    beforeEach(mockRequest);

    test('get connection status', async function () {
        const http = base.getSandbox().stub(request, 'run').resolves({
            statusCode: 200,
            body: {status: 'connected'},
            headers: {}
        });

        const result = await impl.getConnectionStatus('540155', 'node-a');
        result.should.have.property('status', 'connected');

        const options = http.args[0][0];
        options.headers.should.have.size(2);
        options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
        options.headers.should.have.property('x-rh-identity', 'identity');
    });

    test('returns null when account or node is incorrect', async function () {
        base.getSandbox().stub(Connector.prototype, 'doHttp').resolves([]);
        await expect(impl.getConnectionStatus('540155', 'node-a')).resolves.toBeNull();
    });

    test('ping', async function () {
        base.getSandbox().stub(Connector.prototype, 'doHttp').resolves({status: 'connected'});
        await impl.ping();
    });

    test('connection error handling', async function () {
        base.mockRequestError();
        expect(impl.getConnectionStatus('540155', 'node-a')).rejects.toThrow(errors.DependencyError);
    });

    test('status code handling', async function () {
        base.mockRequestStatusCode();
        expect(impl.getConnectionStatus('540155', 'node-a')).rejects.toThrow(errors.DependencyError);
    });
});
