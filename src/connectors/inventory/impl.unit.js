'use strict';

const impl = require('./impl');
const base = require('../../test');
const http = require('../http');
const Connector = require('../Connector');
const { mockRequest } = require('../testUtils');

function inventoryResponse (results, total = results.length) {
    return {
        results,
        total
    };
}

describe('inventory impl', function () {
    beforeEach(mockRequest);

    test('does not make a call for empty list', async function () {
        const spy = base.getSandbox().spy(http, 'request');
        const result = await impl.getSystemDetailsBatch([]);

        result.should.be.empty();
        spy.called.should.be.false();
    });

    test('forwards request headers', async function () {
        const spy = base.getSandbox().stub(Connector.prototype, 'doHttp').resolves(inventoryResponse([]));

        await impl.getSystemDetailsBatch(['id']);
        const headers = spy.args[0][0].headers;
        headers.should.have.size(2);
        headers.should.have.property('x-rh-identity', 'identity');
        headers.should.have.property('x-rh-insights-request-id', 'request-id');
    });

    test('getSystemsByInsightsId', async function () {
        const spy = base.getSandbox().stub(Connector.prototype, 'doHttp').resolves({
            results: [{
                account: 'inventory01',
                id: 'fakeid',
                insights_id: null,
                display_name: null,
                fqdn: 'example.com',
                updated: '2018-12-19T14:59:47.954018Z'
            }]
        });

        const result = await impl.getSystemsByInsightsId('3ecd82fb-abdd-471c-9ca2-249c055644b8');
        result.should.be.empty();
        spy.callCount.should.equal(1);
    });

    test('getSystemsByInsightsId (2)', async function () {
        const response1 = inventoryResponse(Array(100).fill({
            account: 'inventory01',
            id: 'fakeid',
            insights_id: null,
            display_name: null,
            fqdn: 'example.com',
            updated: '2018-12-19T14:59:47.954018Z'
        }), 1201);

        const response2 = inventoryResponse([{
            account: 'inventory01',
            id: 'real deal',
            insights_id: '3ecd82fb-abdd-471c-9ca2-249c055644b8',
            display_name: null,
            fqdn: 'example.com',
            updated: '2018-12-19T14:59:47.954018Z'
        }], 1201);

        const spy = base.getSandbox().stub(Connector.prototype, 'doHttp');
        [...Array(12).fill(response1), response2].forEach((value, key) => spy.onCall(key).resolves(value));

        const result = await impl.getSystemsByInsightsId('3ecd82fb-abdd-471c-9ca2-249c055644b8');
        result.should.have.length(1);
        result[0].should.have.property('id', 'real deal');
        spy.callCount.should.equal(13);
    });
});
