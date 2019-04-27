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
            headers: {}
        });

        await expect(impl.getTemplate('rhel7', 'standard', 'sshd_disable_root_login')).resolves.toMatchSnapshot();
        http.callCount.should.equal(1);
    });
});
