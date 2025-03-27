'use strict';

const impl = require('./impl');
const base = require('../../test');
const { mockRequest, mockCache } = require('../testUtils');
const request = require('../../util/request');
const errors = require('../../errors');
const RequestError = require('request-promise-core/errors').RequestError;

/* eslint-disable max-len */
describe('compliance impl', function () {

    beforeEach(mockRequest);

    test('obtains rule info', async function () {
        const cache = mockCache();

        const http = base.getSandbox().stub(request, 'run').resolves({
            statusCode: 200,
            body: {
                data: {
                    id: 'e57953ac-4211-422d-bcaa-abebc42593f5',
                    type: 'rule',
                    attributes: {
                        created_at: '2019-01-17T13:29:49.061Z',
                        updated_at: '2019-01-17T13:29:49.061Z',
                        ref_id: 'xccdf_org.ssgproject.content_rule_sshd_disable_root_login',
                        title: 'Disable SSH Root Login',
                        rationale: 'Even though the communications channel may be encrypted, an additional layer of\nsecurity is gained by extending the policy of not logging directly on as root.\nIn addition, logging in with a user-specific account provides individual\naccountability of actions performed on the system and also helps to minimize\ndirect attack attempts on root\'s password.',
                        description: 'The root user should never be allowed to login to a\nsystem directly over a network.\nTo disable root login via SSH, add or correct the following line\nin /etc/ssh/sshd_config:\nPermitRootLogin no',
                        severity: 'Medium',
                        total_systems_count: 0,
                        affected_systems_count: 4
                    }
                }
            },
            headers: {}
        });

        const result = await impl.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login');
        result.should.property('ref_id', 'xccdf_org.ssgproject.content_rule_sshd_disable_root_login');
        result.should.property('title', 'Disable SSH Root Login');

        http.callCount.should.equal(1);
        const options = http.args[0][0];
        options.headers.should.have.size(2);
        options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
        options.headers.should.have.property('x-rh-identity', 'identity');
        cache.get.callCount.should.equal(1);
        cache.setex.callCount.should.equal(1);

        await impl.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login');
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
                data: {
                    id: 'e57953ac-4211-422d-bcaa-abebc42593f5',
                    type: 'rule',
                    attributes: {
                        created_at: '2019-01-17T13:29:49.061Z',
                        updated_at: '2019-01-17T13:29:49.061Z',
                        ref_id: 'xccdf_org.ssgproject.content_rule_sshd_disable_root_login',
                        title: 'Disable SSH Root Login',
                        rationale: 'Even though the communications channel may be encrypted, an additional layer of\nsecurity is gained by extending the policy of not logging directly on as root.\nIn addition, logging in with a user-specific account provides individual\naccountability of actions performed on the system and also helps to minimize\ndirect attack attempts on root\'s password.',
                        description: 'The root user should never be allowed to login to a\nsystem directly over a network.\nTo disable root login via SSH, add or correct the following line\nin /etc/ssh/sshd_config:\nPermitRootLogin no',
                        severity: 'Medium',
                        total_systems_count: 0,
                        affected_systems_count: 4
                    }
                }
            },
            headers: {}
        });

        const result = await impl.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login');
        result.should.property('ref_id', 'xccdf_org.ssgproject.content_rule_sshd_disable_root_login');
        result.should.property('title', 'Disable SSH Root Login');

        http.callCount.should.equal(3);
        const options = http.args[0][0];
        options.headers.should.have.size(2);
        options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
        options.headers.should.have.property('x-rh-identity', 'identity');
        cache.get.callCount.should.equal(3);
        cache.setex.callCount.should.equal(1);

        await impl.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login');
        cache.get.callCount.should.equal(4);
        cache.setex.callCount.should.equal(1);
    });

    test('returns empty array on unknown resolution', async function () {
        const cache = mockCache();

        const http = base.getSandbox().stub(request, 'run').resolves({
            statusCode: 404,
            body: {},
            headers: {}
        });

        await expect(impl.getRule('unknown-rule')).resolves.toBeNull();

        http.callCount.should.equal(1);
        cache.get.callCount.should.equal(1);
        cache.setex.callCount.should.equal(0);
    });

    test('status code handling', async function () {
        base.mockRequestStatusCode();
        await expect(impl.getRule('unknown-rule')).rejects.toThrow(errors.DependencyError);
    });

    test('403 response handling', async function () {
        base.mockRequestStatusCode(403);
        await expect(impl.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login')).resolves.toBeNull();
    });
});
