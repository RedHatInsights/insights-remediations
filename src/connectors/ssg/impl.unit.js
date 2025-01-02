'use strict';

const fs = require('fs');
const path = require('path');
const impl = require('./impl');
const base = require('../../test');
const { mockRequest } = require('../testUtils');
const request = require('../../util/request');

const REQ = {
    headers: {
        'x-rh-identity': 'identity',
        'x-rh-insights-request-id': 'request-id'
    },
    identity: { type: 'test' },
    user: { username: 'test', account_number: 'test' }
};

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

        const { template, version } = await impl.getTemplate(REQ, 'rhel7', 'standard', 'sshd_disable_root_login');
        version.should.equal('unit');
        expect(template).toMatchSnapshot();
        http.callCount.should.equal(1);
    });
});
