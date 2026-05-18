'use strict';

const fs = require('fs');
const path = require('path');
const impl = require('./impl');
const base = require('../../test');
const { mockRequest } = require('../testUtils');
const request = require('../../util/request');

describe('ssg impl', function () {
    beforeEach(mockRequest);

    test('returns template', async function () {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const data = fs.readFileSync(path.join(__dirname, 'mock', 'standard', 'service_rsyslog_enabled.yml'), 'utf-8');

        const http = base.getSandbox().stub(request, 'run').resolves({
            statusCode: 200,
            body: data,
            headers: {
                'x-ssg-version': 'unit'
            }
        });

        const { template, version } = await impl.getTemplate('rhel7', 'standard', 'sshd_disable_root_login');
        version.should.equal('unit');
        expect(template).toMatchSnapshot();
        http.callCount.should.equal(1);
    });

    test('returns null on 404', async function () {
        const http = base.getSandbox().stub(request, 'run').resolves({
            statusCode: 404,
            body: 'Not Found',
            headers: {}
        });

        const result = await impl.getTemplate('rhel7', 'standard', 'unknown_rule');
        expect(result).toBeNull();
        http.callCount.should.equal(1);
    });
});
