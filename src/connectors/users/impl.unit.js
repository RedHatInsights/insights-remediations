'use strict';

const impl = require('./impl');
const base = require('../../test');
const Connector = require('../Connector');
const { mockRequest, mockCache } = require('../testUtils');
const request = require('../../util/request');
const errors = require('../../errors');

const MOCK_USER = {
    org_id: '1979710',
    username: '***REMOVED***',
    account_number: '540155',
    is_active: true,
    locale: 'en_US',
    id: 7166102,
    email: 'jharting@redhat.com',
    first_name: 'Jozef',
    last_name: 'Hartinger',
    address_string: '\'Jozef Hartinger\' jharting@redhat.com',
    is_org_admin: true,
    is_internal: true
};

describe('inventory impl', function () {

    beforeEach(mockRequest);

    test('obtains user info', async function () {
        const http = base.getSandbox().stub(request, 'run').resolves({
            statusCode: 200,
            body: [MOCK_USER],
            headers: {}
        });

        const result = await impl.getUser('***REMOVED***');
        result.should.have.property('username', '***REMOVED***');
        result.should.have.property('first_name', 'Jozef');
        result.should.have.property('last_name', 'Hartinger');

        http.callCount.should.equal(1);
        const options = http.args[0][0];
        options.headers.should.have.size(3);
        options.headers.should.have.property('x-rh-apitoken', '');
        options.headers.should.have.property('x-rh-insights-env', 'prod');
        options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
    });

    test('returns null when user does not exist', async function () {
        base.getSandbox().stub(Connector.prototype, 'doHttp').resolves([]);
        expect(impl.getUser('***REMOVED***')).resolves.toBeNull();
    });

    test('ping', async function () {
        base.getSandbox().stub(Connector.prototype, 'doHttp').resolves([MOCK_USER]);
        await impl.ping();
    });

    test('caches retrieved info', async function () {
        const http = base.getSandbox().stub(request, 'run').resolves({
            statusCode: 200,
            body: [MOCK_USER],
            headers: {}
        });

        const cache = mockCache();

        await impl.getUser('***REMOVED***');
        http.callCount.should.equal(1);
        cache.get.callCount.should.equal(1);
        cache.get.args[0][0].should.equal('remediations|http-cache|users|***REMOVED***');
        cache.setex.callCount.should.equal(1);

        await impl.getUser('***REMOVED***');
        http.callCount.should.equal(1);
        cache.get.callCount.should.equal(2);
        cache.get.args[1][0].should.equal('remediations|http-cache|users|***REMOVED***');
        cache.setex.callCount.should.equal(1);
    });

    test('connection error handling', async function () {
        base.mockRequestError();
        expect(impl.getUser('***REMOVED***')).rejects.toThrowError(errors.DependencyError);
    });

    test('status code handling', async function () {
        base.mockRequestStatusCode();
        expect(impl.getUser('***REMOVED***')).rejects.toThrowError(errors.DependencyError);
    });
});
