'use strict';
/* eslint-disable max-len */
/* eslint-disable security/detect-non-literal-fs-filename */

const P = require('bluebird');
const fs = require('fs');
const path = require('path');
const compliance = require('./compliance');
const base = require('../../test');
const { mockRequest } = require('../testUtils');
const request = require('../../util/request');

describe('compliance impl', function () {
    beforeEach(mockRequest);

    test('returns template', async function () {
        const http = base.getSandbox().stub(request, 'run').resolves({
            statusCode: 200,
            body: [{
                template: fs.readFileSync(path.join(__dirname, 'mock', 'standard', 'service_autofs_disabled.yml'), 'utf-8'),
                version: 'unit'
            }],
            headers: {
                'x-ssg-version': 'unit'
            }
        });

        const { template, version } = await compliance.getTemplate('rhel7|standard|xccdf_org.ssgproject.content_rule_service_autofs_disabled');

        version.should.equal('unit');
        expect(template).toMatchSnapshot();
        http.callCount.should.equal(1);
    });

    test('returns template for multiple issues', async function () {
        const http = base.getSandbox().stub(request, 'run').resolves({
            statusCode: 200,
            body: [{
                template: fs.readFileSync(path.join(__dirname, 'mock', 'standard', 'service_autofs_disabled.yml'), 'utf-8'),
                version: 'unit'
            }, {
                template: fs.readFileSync(path.join(__dirname, 'mock', 'standard', 'service_rsyslog_enabled.yml'), 'utf-8'),
                version: 'unit'
            }],
            headers: {
                'x-ssg-version': 'unit'
            }
        });

        const pending = [
            compliance.getTemplate('rhel7|standard|xccdf_org.ssgproject.content_rule_service_autofs_disabled'),
            compliance.getTemplate('rhel7|standard|xccdf_org.ssgproject.content_rule_service_rsylog_enabled.yml')
        ];

        const results = await P.all(pending);

        results[0].version.should.equal('unit');
        results[1].version.should.equal('unit');
        expect(results[0].template).toMatchSnapshot();
        expect(results[1].template).toMatchSnapshot();
        http.callCount.should.equal(1);
    });
});
