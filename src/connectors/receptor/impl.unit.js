'use strict';

const impl = require('./impl');
const base = require('../../test');
const Connector = require('../Connector');
const { mockRequest } = require('../testUtils');
const request = require('../../util/request');
const errors = require('../../errors');

const RECEPTORWORKREQUEST = {
    account: '540155',
    recipient: 'node-a',
    payload: 'payload',
    directive: 'receptor_satellite:execute'
};

const REQ = {
    headers: {
        'x-rh-identity': 'identity',
        'x-rh-insights-request-id': 'request-id'
    },
    identity: { type: 'test' },
    user: { username: 'test', account_number: 'test' }
};

describe('receptor impl', function () {
    beforeEach(mockRequest);

    describe('connection status', function () {
        test('get connection status', async function () {
            const http = base.getSandbox().stub(request, 'run').resolves({
                statusCode: 201,
                body: {status: 'connected'},
                headers: {}
            });

            const result = await impl.getConnectionStatus(REQ, '540155', 'node-a');
            result.should.have.property('status', 'connected');

            const options = http.args[0][0];
            options.should.have.property('uri', 'http://localhost:9090/connection/status');
            options.body.should.eql({
                account: '540155',
                node_id: 'node-a'
            });

            options.headers.should.have.size(2);
            options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
            options.headers.should.have.property('x-rh-identity', 'identity');
        });

        test('returns null when account or node is incorrect', async function () {
            base.getSandbox().stub(Connector.prototype, 'doHttp').resolves([]);
            await expect(impl.getConnectionStatus(REQ, '540155', 'node-a')).resolves.toBeNull();
        });

        test('ping', async function () {
            base.getSandbox().stub(Connector.prototype, 'doHttp').resolves({status: 'connected'});
            await impl.ping(REQ);
        });

        test('connection error handling', async function () {
            base.mockRequestError();
            await expect(impl.getConnectionStatus(REQ, '540155', 'node-a')).rejects.toThrow(errors.DependencyError);
        });

        test('status code handling', async function () {
            base.mockRequestStatusCode();
            await expect(impl.getConnectionStatus(REQ, '540155', 'node-a')).rejects.toThrow(errors.DependencyError);
        });
    });

    describe('initial work request', function () {
        test('post receptor work request', async function () {
            const http = base.getSandbox().stub(request, 'run').resolves({
                statusCode: 201,
                body: {id: '355986a3-5f37-40f7-8f36-c3ac928ce190'},
                headers: {}
            });

            const result = await impl.postInitialRequest(REQ, RECEPTORWORKREQUEST);
            result.should.have.property('id', '355986a3-5f37-40f7-8f36-c3ac928ce190');

            const options = http.args[0][0];
            options.should.have.property('uri', 'http://localhost:9090/job');
            options.headers.should.have.size(2);
            options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
            options.headers.should.have.property('x-rh-identity', 'identity');
            options.body.should.eql({
                account: '540155',
                recipient: 'node-a',
                payload: 'payload',
                directive: 'receptor_satellite:execute'
            });
        });

        test('returns null receptorWorkRequest is incorrect', async function () {
            base.getSandbox().stub(Connector.prototype, 'doHttp').resolves([]);
            await expect(impl.postInitialRequest(REQ, RECEPTORWORKREQUEST)).resolves.toBeNull();
        });

        test('connection error handling receptorWorkRequest', async function () {
            base.mockRequestError();
            await expect(impl.postInitialRequest(REQ, RECEPTORWORKREQUEST)).rejects.toThrow(errors.DependencyError);
        });

        test('status code handling receptorWorkRequest', async function () {
            base.mockRequestStatusCode();
            await expect(impl.postInitialRequest(REQ, RECEPTORWORKREQUEST)).rejects.toThrow(errors.DependencyError);
        });
    });
});
