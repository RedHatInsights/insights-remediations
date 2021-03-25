'use strict';

const _ = require('lodash');
const URI = require('urijs');
const impl = require('./impl');
const base = require('../../test');
const http = require('../http');
const Connector = require('../Connector');
const { mockRequest, mockCache } = require('../testUtils');
const request = require('../../util/request');
const RequestError = require('request-promise-core/errors').RequestError;

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
                        facts: [
                            {
                                namespace: 'satellite',
                                facts: {
                                    satellite_instance_id: '3ec37799-a5b9-418f-a763-9d2e0ccf1fff'
                                }
                            }
                        ],
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
        result.facts[0].facts.should.have.property('satellite_instance_id', '3ec37799-a5b9-418f-a763-9d2e0ccf1fff');

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

    test('retries on failure', async function () {
        const cache = mockCache();
        const http = base.getSandbox().stub(request, 'run');

        http.onFirstCall().rejects(new RequestError('Error: socket hang up'));
        http.onSecondCall().rejects(new RequestError('Error: socket hang up'));
        http.resolves({
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

        http.callCount.should.equal(3);
        const options = http.args[0][0];
        options.headers.should.have.size(2);
        options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
        options.headers.should.have.property('x-rh-identity', 'identity');
        cache.get.callCount.should.equal(3);
        cache.setex.callCount.should.equal(1);

        await impl.getSystemDetailsBatch(['id']);
        cache.get.callCount.should.equal(4);
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

    test('handles many systems', async function () {
        const mocks = _.keyBy(Array(250).fill(0).map((value, key) => ({
            account: 'inventory01',
            id: `84762eb3-0bbb-4bd8-ab11-f420c50e9${String(key).padStart(3, '0')}`,
            insights_id: null,
            display_name: null,
            fqdn: `${String(key).padStart(3, '0')}.example.com`,
            updated: '2018-12-19T14:59:47.954018Z'
        })), 'id');

        base.getSandbox().stub(request, 'run').callsFake(params => {
            const { path } = URI.parse(params.uri);

            const parts = path.split('/');
            const ids = parts[parts.length - 1].split(',');
            const results = _.pickBy(mocks, (value, key) => ids.includes(key));

            return Promise.resolve({
                statusCode: 200,
                body: {
                    count: results.length,
                    page: 1,
                    per_page: 100,
                    results,
                    total: 250
                },
                headers: {}
            });
        });

        const ids = Array(250).fill(0).map((value, key) => `84762eb3-0bbb-4bd8-ab11-f420c50e9${String(key).padStart(3, '0')}`);

        const result = await impl.getSystemDetailsBatch(ids);
        result.should.have.size(250);
        ids.forEach(id => _.has(result, id).should.be.true());
    });

    describe('getSystemsProfileBatch', function () {
        test('does not make a call for empty list', async function () {
            const spy = base.getSandbox().spy(http, 'request');
            const result = await impl.getSystemProfileBatch([]);

            result.should.be.empty();
            spy.called.should.be.false();
        });

        test('forwards request headers', async function () {
            const spy = base.getSandbox().stub(Connector.prototype, 'doHttp').resolves(inventoryResponse([]));

            await impl.getSystemProfileBatch(['id']);
            const headers = spy.args[0][0].headers;
            headers.should.have.size(2);
            headers.should.have.property('x-rh-identity', 'identity');
            headers.should.have.property('x-rh-insights-request-id', 'request-id');
        });

        test('get system profile data', async function () {
            const cache = mockCache();
            const http = base.getSandbox().stub(request, 'run').resolves({
                statusCode: 200,
                body: {
                    count: 1,
                    page: 1,
                    per_page: 50,
                    results: [{
                        id: '9dae9304-86a8-4f66-baa3-a1b27dfdd479',
                        system_profile: {
                            owner_id: '81390ad6-ce49-4c8f-aa64-729d374ee65c',
                            rhc_client_id: 'f415fc2d-9700-4e30-9621-6a410ccc92c8',
                            is_marketplace: true
                        }
                    }]
                },
                headers: {}
            });

            const results = await impl.getSystemProfileBatch(['id']);
            results.should.have.size(1);
            results.should.have.property('9dae9304-86a8-4f66-baa3-a1b27dfdd479');
            const result = results['9dae9304-86a8-4f66-baa3-a1b27dfdd479'];
            result.should.have.property('id', '9dae9304-86a8-4f66-baa3-a1b27dfdd479');
            result.system_profile.should.have.property('owner_id', '81390ad6-ce49-4c8f-aa64-729d374ee65c');
            result.system_profile.should.have.property('rhc_client_id', 'f415fc2d-9700-4e30-9621-6a410ccc92c8');
            result.system_profile.should.have.property('is_marketplace', true);

            http.callCount.should.equal(1);
            const options = http.args[0][0];
            options.headers.should.have.size(2);
            options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
            options.headers.should.have.property('x-rh-identity', 'identity');
            cache.get.callCount.should.equal(1);
            cache.setex.callCount.should.equal(1);

            await impl.getSystemProfileBatch(['id']);
            cache.get.callCount.should.equal(2);
            cache.setex.callCount.should.equal(1);
        });

        test('retries on failure', async function () {
            const cache = mockCache();
            const http = base.getSandbox().stub(request, 'run');

            http.onFirstCall().rejects(new RequestError('Error: socket hang up'));
            http.onSecondCall().rejects(new RequestError('Error: socket hang up'));
            http.resolves({
                statusCode: 200,
                body: {
                    count: 1,
                    page: 1,
                    per_page: 50,
                    results: [{
                        id: '9dae9304-86a8-4f66-baa3-a1b27dfdd479',
                        system_profile: {
                            owner_id: '81390ad6-ce49-4c8f-aa64-729d374ee65c',
                            rhc_client_id: 'f415fc2d-9700-4e30-9621-6a410ccc92c8',
                            is_marketplace: true
                        }
                    }]
                },
                headers: {}
            });

            const results = await impl.getSystemProfileBatch(['id']);
            results.should.have.size(1);
            results.should.have.property('9dae9304-86a8-4f66-baa3-a1b27dfdd479');
            const result = results['9dae9304-86a8-4f66-baa3-a1b27dfdd479'];
            result.should.have.property('id', '9dae9304-86a8-4f66-baa3-a1b27dfdd479');
            result.system_profile.should.have.property('owner_id', '81390ad6-ce49-4c8f-aa64-729d374ee65c');
            result.system_profile.should.have.property('rhc_client_id', 'f415fc2d-9700-4e30-9621-6a410ccc92c8');
            result.system_profile.should.have.property('is_marketplace', true);

            http.callCount.should.equal(3);
            const options = http.args[0][0];
            options.headers.should.have.size(2);
            options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
            options.headers.should.have.property('x-rh-identity', 'identity');
            cache.get.callCount.should.equal(3);
            cache.setex.callCount.should.equal(1);

            await impl.getSystemProfileBatch(['id']);
            cache.get.callCount.should.equal(4);
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

            await expect(impl.getSystemProfileBatch(['id'])).resolves.toEqual({});

            http.callCount.should.equal(1);
            cache.get.callCount.should.equal(1);
            cache.setex.callCount.should.equal(0);
        });
    });

    describe('getSystemsByInsightsId', function () {
        test('new', async function () {
            base.getSandbox().stub(Connector.prototype, 'doHttp').resolves({
                results: [{
                    account: 'inventory01',
                    id: 'fakeid',
                    insights_id: '3ecd82fb-abdd-471c-9ca2-249c055644b8',
                    display_name: null,
                    fqdn: 'example1.com',
                    updated: '2018-12-19T14:59:47.954018Z'
                }, {
                    account: 'inventory01',
                    id: 'fakeid',
                    insights_id: '3ecd82fb-abdd-471c-9ca2-249c055644b8',
                    display_name: null,
                    fqdn: 'example2.com',
                    updated: '2018-12-19T14:59:47.954018Z'
                }],
                total: 1
            });

            const result = await impl.getSystemsByInsightsId('3ecd82fb-abdd-471c-9ca2-249c055644b8');
            result.should.has.size(2);
            result[0].should.have.property('insights_id', '3ecd82fb-abdd-471c-9ca2-249c055644b8');
            result[1].should.have.property('insights_id', '3ecd82fb-abdd-471c-9ca2-249c055644b8');
        });
    });
});
