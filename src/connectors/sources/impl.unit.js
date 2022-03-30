'use strict';

const impl = require('./impl');
const base = require('../../test');
const { mockRequest } = require('../testUtils');
const request = require('../../util/request');

describe('sources impl', function () {
    beforeEach(mockRequest);

    describe('findSources', function () {
        test('obtains a list of sources by source_ref', async function () {
            const http = base.getSandbox().stub(request, 'run').resolves({
                statusCode: 200,
                body: {
                    meta: {
                        count: 2,
                        limit: 100,
                        offset: 0
                    },
                    data: [{
                        created_at: '2019-12-13T11:47:00Z',
                        id: '1231',
                        name: 'We will be adding receptor',
                        source_ref: '72e67490-010a-4c69-a445-97017ef2a696',
                        source_type_id: '9',
                        uid: '49cd4278-3be8-4862-944f-17187c3b568e',
                        updated_at: '2019-12-13T11:47:00Z'
                    }, {
                        created_at: '2019-12-13T11:51:51Z',
                        id: '1232',
                        name: 'Adding receptor',
                        source_ref: 'de91d755-e1da-4ae2-b173-7d56f5df7c86',
                        source_type_id: '9',
                        uid: 'd6f76802-5a47-42bc-b89a-f1abf17b5f2c',
                        updated_at: '2019-12-13T11:51:51Z'
                    }]
                },
                headers: {}
            });

            const results = await impl.findSources([
                '72e67490-010a-4c69-a445-97017ef2a696', 'de91d755-e1da-4ae2-b173-7d56f5df7c86'
            ]);
            results.should.have.size(2);
            results.should.have.property('72e67490-010a-4c69-a445-97017ef2a696');
            results['72e67490-010a-4c69-a445-97017ef2a696'].should.have.property('id', '1231');
            results.should.have.property('de91d755-e1da-4ae2-b173-7d56f5df7c86');
            results['de91d755-e1da-4ae2-b173-7d56f5df7c86'].should.have.property('id', '1232');

            const options = http.args[0][0];
            // eslint-disable-next-line max-len
            options.uri.should.equal('http://localhost:8080/api/sources/v2.0/sources?filter%5Bsource_ref%5D%5Beq%5D%5B%5D=72e67490-010a-4c69-a445-97017ef2a696&filter%5Bsource_ref%5D%5Beq%5D%5B%5D=de91d755-e1da-4ae2-b173-7d56f5df7c86');
            options.headers.should.have.size(2);
            options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
            options.headers.should.have.property('x-rh-identity', 'identity');
        });
    });

    describe('getEndoints', function () {
        test('obtains endpoints for a given sources id', async function () {
            const http = base.getSandbox().stub(request, 'run').resolves({
                statusCode: 200,
                body: {
                    meta: {
                        count: 1,
                        limit: 100,
                        offset: 0
                    },
                    data: [{
                        created_at: '2019-12-13T11:47:01Z',
                        default: true,
                        id: '805',
                        receptor_node: 'dsasd',
                        role: 'sattelite',
                        source_id: '1231',
                        updated_at: '2019-12-13T11:47:01Z'
                    }]
                },
                headers: {}
            });

            const results = await impl.getEndoints(['1231']);
            results.should.have.size(1);
            results[0].should.have.property('receptor_node', 'dsasd');

            const options = http.args[0][0];
            options.uri.should.equal('http://localhost:8080/api/sources/v2.0/sources/1231/endpoints');
            options.headers.should.have.size(2);
            options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
            options.headers.should.have.property('x-rh-identity', 'identity');
        });

        test('returns null on 404', async function () {
            base.getSandbox().stub(request, 'run').resolves({
                statusCode: 404,
                headers: {}
            });

            const results = await impl.getEndoints(['1231']);
            (results === null).should.be.true();
        });
    });

    describe('getSourceInfo', function () {
        test('obtains a list of sources with endpoints', async function () {
            const mock = base.getSandbox().stub(request, 'run');
            mock.onFirstCall().resolves({
                statusCode: 200,
                body: {
                    meta: {
                        count: 2,
                        limit: 100,
                        offset: 0
                    },
                    data: [{
                        created_at: '2019-12-13T11:47:00Z',
                        id: '1231',
                        name: 'We will be adding receptor',
                        source_ref: '72e67490-010a-4c69-a445-97017ef2a696',
                        source_type_id: '9',
                        uid: '49cd4278-3be8-4862-944f-17187c3b568e',
                        updated_at: '2019-12-13T11:47:00Z',
                        tenant: '6089719'
                    }, {
                        created_at: '2019-12-13T11:51:51Z',
                        id: '1232',
                        name: 'Adding receptor',
                        source_ref: 'de91d755-e1da-4ae2-b173-7d56f5df7c86',
                        source_type_id: '9',
                        uid: 'd6f76802-5a47-42bc-b89a-f1abf17b5f2c',
                        updated_at: '2019-12-13T11:51:51Z',
                        tenant: '6089719'
                    }]
                },
                headers: {}
            });

            mock.onSecondCall().resolves({
                statusCode: 200,
                body: {
                    meta: {
                        count: 1,
                        limit: 100,
                        offset: 0
                    },
                    data: [{
                        created_at: '2019-12-13T11:47:01Z',
                        default: true,
                        id: '805',
                        receptor_node: 'dsasd',
                        role: 'sattelite',
                        source_id: '1231',
                        updated_at: '2019-12-13T11:47:01Z',
                        tenant: '6089719'
                    }]
                },
                headers: {}
            });

            mock.onThirdCall().resolves({
                statusCode: 404,
                headers: {}
            });

            const results = await impl.getSourceInfo([
                '72e67490-010a-4c69-a445-97017ef2a696', 'de91d755-e1da-4ae2-b173-7d56f5df7c86'
            ]);
            results.should.have.size(2);
            results.should.have.property('72e67490-010a-4c69-a445-97017ef2a696');
            const first = results['72e67490-010a-4c69-a445-97017ef2a696'];
            first.should.have.property('id', '1231');
            first.should.have.property('endpoints');
            first.endpoints.should.have.size(1);
            first.endpoints[0].should.have.property('receptor_node', 'dsasd');
            const second = results['de91d755-e1da-4ae2-b173-7d56f5df7c86'];
            second.should.have.property('id', '1232');
            second.should.have.property('endpoints');
            (second.endpoints === null).should.be.true();
        });

        test('does not call anything on an empty list', async function () {
            const spy = base.getSandbox().spy(request, 'run');

            const results = await impl.getSourceInfo([]);
            results.should.be.empty();
            spy.callCount.should.equal(0);
        });
    });

    describe('getRHCConnections', function () {
        test('obtains RHC connections for a given source', async function () {
            const http = base.getSandbox().stub(request, 'run').resolves({
                statusCode: 200,
                body: {
                    meta: {
                        count: 1,
                        limit: 100,
                        offset: 0
                    },
                    data: [{
                        id: '153',
                        rhc_id: 'd415fc2d-9700-4e30-9621-6a410ccc92d8',
                        last_checked_at: '0001-01-01T00:00:00Z',
                        last_available_at: '0001-01-01T00:00:00Z',
                        source_ids: [
                            '7'
                        ]
                    }]
                },
                headers: {}
            });

            const results = await impl.getRHCConnections('d415fc2d-9700-4e30-9621-6a410ccc92d8');
            results.should.have.size(1);

            const result = results[0];
            result.should.have.property('id', '153');
            result.should.have.property('rhc_id', 'd415fc2d-9700-4e30-9621-6a410ccc92d8');

            const options = http.args[0][0];
            // eslint-disable-next-line max-len
            options.uri.should.equal('http://localhost:8080/api/sources/v3.1/sources/d415fc2d-9700-4e30-9621-6a410ccc92d8/rhc_connections');
            options.headers.should.have.size(2);
            options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
            options.headers.should.have.property('x-rh-identity', 'identity');
        });

        test('returns null on 404', async function () {
            base.getSandbox().stub(request, 'run').resolves({
                statusCode: 404,
                headers: {}
            });

            const results = await impl.getRHCConnections('1231');
            (results === null).should.be.true();
        });
    });
});
