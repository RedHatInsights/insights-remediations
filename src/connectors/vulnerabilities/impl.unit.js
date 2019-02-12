'use strict';

const impl = require('./impl');
const base = require('../../test');
const { mockRequest, mockCache } = require('../testUtils');
const request = require('../../util/request');

describe('vulnerabilities impl', function () {

    beforeEach(mockRequest);

    describe('getSystems', function () {
        test('returns system ids', async function () {
            const cache = mockCache();

            const http = base.getSandbox().stub(request, 'run').resolves({
                statusCode: 200,
                body: {
                    meta: {
                        page: 1,
                        page_size: 40,
                        total_items: 1,
                        pages: 1,
                        sort: '',
                        filter: ''
                    },
                    data: [
                        {
                            type: 'system',
                            id: '802cab91-410f-473b-b4c6-b1524c45ba8c',
                            attributes: {
                                inventory_id: '802cab91-410f-473b-b4c6-b1524c45ba8c',
                                status_id: 0,
                                status_name: 'Not Reviewed'
                            }
                        },
                        {
                            type: 'system',
                            id: '6ac1bb84-333d-48e5-bf02-7a9b0263d220',
                            attributes: {
                                inventory_id: '6ac1bb84-333d-48e5-bf02-7a9b0263d220',
                                status_id: 0,
                                status_name: 'Not Reviewed'
                            }
                        }
                    ]
                },
                headers: {}
            });

            await expect(impl.getSystems('rule')).resolves.toEqual([
                '802cab91-410f-473b-b4c6-b1524c45ba8c',
                '6ac1bb84-333d-48e5-bf02-7a9b0263d220'
            ]);

            http.callCount.should.equal(1);
            cache.get.callCount.should.equal(0);
            cache.setex.callCount.should.equal(0);
        });

        test('returns empty array on 404', async function () {
            const cache = mockCache();

            const http = base.getSandbox().stub(request, 'run').resolves({
                statusCode: 200,
                body: {
                    meta: {
                        page: 1,
                        page_size: 40,
                        total_items: 1,
                        pages: 1,
                        sort: '',
                        filter: ''
                    },
                    data: []
                },
                headers: {}
            });

            await expect(impl.getSystems('unknown-rule')).resolves.toEqual([]);

            http.callCount.should.equal(1);
            cache.get.callCount.should.equal(0);
            cache.setex.callCount.should.equal(0);
        });
    });
});
