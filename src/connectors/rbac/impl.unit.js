'use strict';

const impl = require('./impl');
const base = require('../../test');
const Connector = require('../Connector');
const { mockRequest, mockCache } = require('../testUtils');
const request = require('../../util/request');
const errors = require('../../errors');
const RequestError = require('request-promise-core/errors').RequestError;

const REQ = {
    headers: {
        'x-rh-identity': 'identity',
        'x-rh-insights-request-id': 'request-id'
    },
    identity: { type: 'test' },
    user: { username: 'test', account_number: 'test' }
};

describe('rbac impl', function () {
    beforeEach(mockRequest);

    test('get remediations access', async function () {
        const cache = mockCache();
        const http = base.getSandbox().stub(request, 'run').resolves({
            statusCode: 200,
            body: {
                meta: {
                    count: 1,
                    limit: 10,
                    offset: 0
                },
                links: {
                    first: '/api/rbac/v1/access/?application=remediations&limit=10&offset=0',
                    next: null,
                    previous: null,
                    last: '/api/rbac/v1/access/?application=remediations&limit=10&offset=0'
                },
                data: [
                    {
                        permission: 'remediations:*:*',
                        resourceDefinitions: []
                    }
                ]
            },
            headers: {}
        });

        const result = await impl.getRemediationsAccess(REQ);
        result.meta.should.have.property('count', 1);
        result.meta.should.have.property('limit', 10);
        result.meta.should.have.property('offset', 0);

        result.links.should.have.property(
            'first', '/api/rbac/v1/access/?application=remediations&limit=10&offset=0'
        );
        result.links.should.have.property('next', null);
        result.links.should.have.property('previous', null);
        result.links.should.have.property(
            'last', '/api/rbac/v1/access/?application=remediations&limit=10&offset=0'
        );

        result.data[0].should.have.property('permission', 'remediations:*:*');
        result.data[0].should.have.property('resourceDefinitions', []);

        const options = http.args[0][0];
        options.uri.should.equal('http://localhost:8080/api/rbac/v1/access/?application=remediations');
        options.headers.should.have.size(2);
        options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
        options.headers.should.have.property('x-rh-identity', 'identity');

        cache.get.callCount.should.equal(0);
        cache.setex.callCount.should.equal(0);
    });

    test('retries when operation errors out', async function () {
        const cache = mockCache();
        const http = base.getSandbox().stub(request, 'run');

        http.onFirstCall().rejects(new RequestError('Error: socket hang up'));
        http.onSecondCall().rejects(new RequestError('Error: socket hang up'));
        http.resolves({
            statusCode: 200,
            body: {
                meta: {
                    count: 1,
                    limit: 10,
                    offset: 0
                },
                links: {
                    first: '/api/rbac/v1/access/?application=remediations&limit=10&offset=0',
                    next: null,
                    previous: null,
                    last: '/api/rbac/v1/access/?application=remediations&limit=10&offset=0'
                },
                data: [
                    {
                        permission: 'remediations:*:*',
                        resourceDefinitions: []
                    }
                ]
            },
            headers: {}
        });

        const result = await impl.getRemediationsAccess(REQ);
        result.meta.should.have.property('count', 1);
        result.meta.should.have.property('limit', 10);
        result.meta.should.have.property('offset', 0);

        result.links.should.have.property(
            'first', '/api/rbac/v1/access/?application=remediations&limit=10&offset=0'
        );
        result.links.should.have.property('next', null);
        result.links.should.have.property('previous', null);
        result.links.should.have.property(
            'last', '/api/rbac/v1/access/?application=remediations&limit=10&offset=0'
        );

        result.data[0].should.have.property('permission', 'remediations:*:*');
        result.data[0].should.have.property('resourceDefinitions', []);

        http.callCount.should.equal(3);
        const options = http.args[0][0];
        options.uri.should.equal('http://localhost:8080/api/rbac/v1/access/?application=remediations');
        options.headers.should.have.size(2);
        options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
        options.headers.should.have.property('x-rh-identity', 'identity');

        cache.get.callCount.should.equal(0);
        cache.setex.callCount.should.equal(0);
    });

    test('returns null when operation failed', async function () {
        base.getSandbox().stub(Connector.prototype, 'doHttp').resolves([]);
        await expect(impl.getRemediationsAccess(REQ)).resolves.toBeNull();
    });

    test('ping', async function () {
        base.getSandbox().stub(Connector.prototype, 'doHttp').resolves(
            {
                meta: {
                    count: 1,
                    limit: 10,
                    offset: 0
                },
                links: {
                    first: '/api/rbac/v1/access/?application=remediations&limit=10&offset=0',
                    next: null,
                    previous: null,
                    last: '/api/rbac/v1/access/?application=remediations&limit=10&offset=0'
                },
                data: [
                    {
                        permission: 'remediations:*:*',
                        resourceDefinitions: []
                    }
                ]
            }
        );

        await impl.ping(REQ);
    });

    test('access error handling', async function () {
        base.mockRequestError();
        await expect(impl.getRemediationsAccess(REQ)).rejects.toThrow(errors.DependencyError);
    });

    test('status code handling', async function () {
        base.mockRequestStatusCode();
        await expect(impl.getRemediationsAccess(REQ)).rejects.toThrow(errors.DependencyError);
    });
});
