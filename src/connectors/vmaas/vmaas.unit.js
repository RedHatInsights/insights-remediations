'use strict';

const impl = require('./vmaas');
const base = require('../../test');
const { mockRequest, mockCache } = require('../testUtils');
const request = require('../../util/request');

describe('inventory impl', function () {

    beforeEach(mockRequest);

    test('obtains CVE info', async function () {
        const cache = mockCache();

        const http = base.getSandbox().stub(request, 'run').resolves({
            statusCode: 200,
            body: {
                cve_list: {
                    'CVE-2017-5715': {
                        redhat_url: '',
                        secondary_url: '',
                        synopsis: 'CVE-2017-5715',
                        impact: 'Important',
                        public_date: '2018-01-03T00:00:00+00:00',
                        modified_date: '2019-02-05T02:45:45+00:00',
                        cwe_list: [
                            'CWE-200'
                        ],
                        cvss3_score: '5.600',
                        cvss3_metrics: 'CVSS:3.0/AV:L/AC:H/PR:L/UI:N/S:C/C:H/I:N/A:N',
                        cvss2_score: '',
                        cvss2_metrics: '',
                        description: 'An industry-wide issue was found in the way many modern microprocessor.',
                        package_list: [],
                        errata_list: []
                    }
                },
                page: 1,
                page_size: 1,
                pages: 1
            },
            headers: {}
        });

        const result = await impl.getCve('CVE-2017-5715');
        result.should.have.property('description', 'An industry-wide issue was found in the way many modern microprocessor.');
        result.should.have.property('synopsis', 'CVE-2017-5715');

        http.callCount.should.equal(1);
        const options = http.args[0][0];
        options.headers.should.have.size(1);
        options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
        cache.get.callCount.should.equal(1);
        cache.setex.callCount.should.equal(1);

        await impl.getCve('CVE-2017-5715');
        cache.get.callCount.should.equal(2);
        cache.setex.callCount.should.equal(1);
    });

    test('returns null on unknown CVE', async function () {
        const cache = mockCache();

        const http = base.getSandbox().stub(request, 'run').resolves({
            statusCode: 200,
            body: {
                cve_list: {},
                page: 1,
                page_size: 0,
                pages: 0
            },
            headers: {}
        });

        await expect(impl.getCve('CVE-2017-57155')).resolves.toBeNull();

        http.callCount.should.equal(1);
        cache.get.callCount.should.equal(1);
        cache.setex.callCount.should.equal(0);
    });
});
