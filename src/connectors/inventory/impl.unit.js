'use strict';

const impl = require('./impl');
const base = require('../../test');
const http = require('../http');
const Connector = require('../Connector');
const { mockRequest, mockCache } = require('../testUtils');
const request = require('../../util/request');

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

    test('obtains rule info', async function () {
        const cache = mockCache();

        const http = base.getSandbox().stub(request, 'run').resolves({
            statusCode: 200,
            body: {
                count: 1,
                page: 1,
                per_page: 50,
                results: [
                    {
                        account: '901578',
                        bios_uuid: 'B2BC4439-2ACA-474A-8904-98F9708428AC',
                        created: '2018-12-19T14:59:47.954014Z',
                        display_name: null,
                        facts: [],
                        fqdn: 'packer-rhel7',
                        id: '9615dda7-5868-4957-88ba-c3064c86d332',
                        insights_id: '3ec37799-a5b9-418f-a763-9d2e0ccf1ff7',
                        ip_addresses: [
                            '10.0.2.15'
                        ],
                        mac_addresses: [
                            '08:00:27:d3:0c:80',
                            '00:00:00:00:00:00'
                        ],
                        rhel_machine_id: null,
                        satellite_id: null,
                        subscription_manager_id: 'bca8b56a-067c-4861-af4e-44add712a71e',
                        tags: [],
                        updated: '2018-12-19T14:59:47.954018Z'
                    }
                ]
            },
            headers: {}
        });

        const results = await impl.getSystemDetailsBatch(['id']);
        results.should.have.size(1);
        results.should.have.property('9615dda7-5868-4957-88ba-c3064c86d332');
        const result = results['9615dda7-5868-4957-88ba-c3064c86d332'];
        result.should.have.property('id', '9615dda7-5868-4957-88ba-c3064c86d332');
        result.should.have.property('hostname', 'packer-rhel7');
        result.should.have.property('display_name', null);

        http.callCount.should.equal(1);
        const options = http.args[0][0];
        options.headers.should.have.size(2);
        options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
        options.headers.should.have.property('x-rh-identity', 'identity');
        cache.get.callCount.should.equal(1);
        cache.setex.callCount.should.equal(1);

        await impl.getSystemDetailsBatch(['id']);
        cache.get.callCount.should.equal(2);
        cache.setex.callCount.should.equal(1);
    });

    test('returns empty object unknown systems', async function () {
        const cache = mockCache();

        const http = base.getSandbox().stub(request, 'run').resolves({
            statusCode: 200,
            body: {
                count: 0,
                page: 1,
                per_page: 50,
                results: [],
                total: 0
            },
            headers: {}
        });

        await expect(impl.getSystemDetailsBatch(['id'])).resolves.toEqual({});

        http.callCount.should.equal(1);
        cache.get.callCount.should.equal(1);
        cache.setex.callCount.should.equal(0);
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
