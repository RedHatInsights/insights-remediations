'use strict';

/* eslint max-len: off */

const impl = require('./impl');
const base = require('../../test');
const { mockRequest, mockCache } = require('../testUtils');
const request = require('../../util/request');

describe('patchman impl', function () {

    beforeEach(mockRequest);

    test('obtains Erratum info', async function () {
        const cache = mockCache();

        const http = base.getSandbox().stub(request, 'run').resolves({
            statusCode: 200,
            body: {
                data: {
                    attributes: {
                        description: 'The tzdata packages contain data files with rules for various time zones.\n\nThe tzdata packages have been updated to version 2019c, which addresses recent\ntime zone changes. Notably:\n\n* Fiji will observe the daylight saving time (DST) from November 10, 2019 to January 12, 2020. \n\n* Norfolk Island will start to observe Australian-style DST on November 06, 2019.\n(BZ#1751551, BZ#1751737, BZ#1751402, BZ#1751404)\n\nUsers of tzdata are advised to upgrade to these updated packages, which add\nthese enhancements.',
                        severity: null,
                        modified_date: '2019-09-23T12:56:33Z',
                        public_date: '2019-09-23T12:56:33Z',
                        topic: 'Updated tzdata packages that add various enhancements are now available for Red\nHat Enterprise Linux 5 Extended Life Cycle Support, Red Hat Enterprise Linux 5.9\nLong Life, Red Hat Enterprise Linux 6, Red Hat Enterprise Linux 6.4 Advanced\nUpdate Support, Red Hat Enterprise Linux 6.5 Advanced Update Support, Red Hat\nEnterprise Linux 6.6 Advanced Update Support, Red Hat Enterprise Linux 6.7 EUS\nExtension for SAP HANA for Siemens, Red Hat Enterprise Linux 7.2 Advanced Update\nSupport, Red Hat Enterprise Linux 7.2 Update Services for SAP Solutions, Red Hat\nEnterprise Linux 7.2 Telco Extended Update Support, Red Hat Enterprise Linux 7.3\nAdvanced Update Support, Red Hat Enterprise Linux 7.3 Update Services for SAP\nSolutions, Red Hat Enterprise Linux 7.3 Telco Extended Update Support, Red Hat\nEnterprise Linux 7.4 Advanced Update Support, Red Hat Enterprise Linux 7.4 Update Services for SAP Solutions, Red Hat Enterprise Linux 7.4 Telco Extended Update Support, Red Hat Enterprise Linux 7.5 Extended Update Support, Red Hat Enterprise Linux 7.6 Extended Update Support, Red Hat Enterprise Linux 7, and Red Hat Enterprise Linux 8.',
                        synopsis: 'tzdata enhancement update',
                        solution: 'Before applying this update, make sure all previously released errata\nrelevant to your system have been applied.\n\nFor details on how to apply this update, refer to:\n\nhttps://access.redhat.com/articles/11258',
                        fixes: null,
                        cves: [],
                        references: []
                    },
                    id: 'RHBA-2019:2871',
                    type: 'advisory'
                }
            },
            headers: {}
        });

        const result = await impl.getErratum('RHBA-2019:2871');
        result.should.have.property('id', 'RHBA-2019:2871');
        result.should.have.property('attributes');
        result.attributes.should.have.property('description', 'The tzdata packages contain data files with rules for various time zones.\n\nThe tzdata packages have been updated to version 2019c, which addresses recent\ntime zone changes. Notably:\n\n* Fiji will observe the daylight saving time (DST) from November 10, 2019 to January 12, 2020. \n\n* Norfolk Island will start to observe Australian-style DST on November 06, 2019.\n(BZ#1751551, BZ#1751737, BZ#1751402, BZ#1751404)\n\nUsers of tzdata are advised to upgrade to these updated packages, which add\nthese enhancements.');
        result.attributes.should.have.property('synopsis', 'tzdata enhancement update');

        http.callCount.should.equal(1);
        const options = http.args[0][0];
        options.headers.should.have.size(1);
        options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
        cache.get.callCount.should.equal(1);
        cache.setex.callCount.should.equal(1);

        await impl.getErratum('RHBA-2019:2871');
        cache.get.callCount.should.equal(2);
        cache.setex.callCount.should.equal(1);
    });

    test('returns null on unknown CVE', async function () {
        const cache = mockCache();

        const http = base.getSandbox().stub(request, 'run').resolves({
            statusCode: 404,
            body: {
                error: 'advisory not found'
            },
            headers: {}
        });

        await expect(impl.getErratum('RHBA-2019:2872')).resolves.toBeNull();

        http.callCount.should.equal(1);
        cache.get.callCount.should.equal(1);
        cache.setex.callCount.should.equal(0);
    });
});
