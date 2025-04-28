'use strict';

const impl = require('./impl');
const base = require('../../test');
const { mockRequest, mockCache } = require('../testUtils');
const _ = require('lodash');
const request = require('../../util/request');
const errors = require('../../errors');
const RequestError = require('request-promise-core/errors').RequestError;

/* eslint-disable max-len */
describe('compliance impl (v1)', function () {

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

describe('compliance impl (v2)', function () {

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

        const result = await impl.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login', 'xccdf_org.ssgproject.content_benchmark_RHEL-8', '0.0.0');
        result.should.property('ref_id', 'xccdf_org.ssgproject.content_rule_sshd_disable_root_login');
        result.should.property('title', 'Disable SSH Root Login');

        http.callCount.should.equal(1);
        const options = http.args[0][0];
        options.headers.should.have.size(2);
        options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
        options.headers.should.have.property('x-rh-identity', 'identity');
        cache.get.callCount.should.equal(2);
        cache.setex.callCount.should.equal(1);

        await impl.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login', 'xccdf_org.ssgproject.content_benchmark_RHEL-8', '0.0.0');
        cache.get.callCount.should.equal(4);
        cache.setex.callCount.should.equal(1);
    });

    test('retries on failure', async function () {
        const cache = mockCache();
        const http = base.getSandbox().stub(request, 'run');

        http.onCall(0).rejects(new RequestError('Error: socket hang up'));
        http.onCall(1).rejects(new RequestError('Error: socket hang up'));
        http.onCall(2).resolves({
            statusCode: 200,
            body: {
                data: {
                    id: 'e57953ac-4211-422d-bcaa-abebc42593f5',
                    type: 'rule',
                    attributes: {
                        ref_id: 'xccdf_org.ssgproject.content_rule_sshd_disable_root_login',
                        title: 'Disable SSH Root Login',
                        rationale: 'Even though the communications channel may be encrypted, an additional layer of security is gained by extending the policy of not logging directly on as root.',
                        description: 'The root user should never be allowed to login to a system directly over a network.',
                        severity: 'Medium',
                        total_systems_count: 0,
                        affected_systems_count: 4
                    }
                }
            },
            headers: {}
        });

        const result = await impl.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login', 'xccdf_org.ssgproject.content_benchmark_RHEL-8', '0.0.0');
        result.should.property('ref_id', 'xccdf_org.ssgproject.content_rule_sshd_disable_root_login');
        result.should.property('title', 'Disable SSH Root Login');

        http.callCount.should.equal(3);
        const options = http.args[0][0];
        options.headers.should.have.size(2);
        options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
        options.headers.should.have.property('x-rh-identity', 'identity');
        cache.get.callCount.should.equal(4);
        cache.setex.callCount.should.equal(1);

        await impl.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login', 'xccdf_org.ssgproject.content_benchmark_RHEL-8', '0.0.0');
        cache.get.callCount.should.equal(6);
        cache.setex.callCount.should.equal(1);
    });

    test('returns empty array on unknown resolution for rule', async function () {
        const cache = mockCache();

        const http = base.getSandbox().stub(request, 'run').resolves({
            statusCode: 404,
            body: {},
            headers: {}
        });

        await expect(impl.getRule('unknown-rule', 'xccdf_org.ssgproject.content_benchmark_RHEL-8', '0.0.0')).resolves.toBeNull();

        http.callCount.should.equal(2);
        cache.get.callCount.should.equal(2);
        cache.setex.callCount.should.equal(0);
    });

    test('status code handling', async function () {
        base.mockRequestStatusCode();
        await expect(impl.getRule('unknown-rule', 'xccdf_org.ssgproject.content_benchmark_RHEL-8', '0.0.0')).rejects.toThrow(errors.DependencyError);
    });

    test('403 response handling', async function () {
        base.mockRequestStatusCode(403);
        await expect(impl.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login', 'xccdf_org.ssgproject.content_benchmark_RHEL-8', '0.0.0')).resolves.toBeNull();
    });

    test('correctly parses ssgId from /security_guides?filter response and then builds v2 URI', async function () {
        const http = base.getSandbox().stub(request, 'run');

        // Mock the response from the /security_guides?filter endpoint
        http.resolves({
            statusCode: 200,
            body: {
                data: [
                    {
                        id: '34a6556f-579b-4f32-a78d-c0444519ecfe',
                        type: 'security_guide',
                        attributes: {
                            title: 'RHEL 8 Security Guide',
                            ref_id: 'xccdf_org.ssgproject.content_benchmark_RHEL-8',
                            version: '0.1.45'
                        }
                    }
                ]
            },
            headers: {}
        });

        // Call the function under test
        const result = await impl.buildV2Uri(
            'xccdf_org.ssgproject.content_rule_sshd_disable_root_login',
            'xccdf_org.ssgproject.content_benchmark_RHEL-8',
            '0.1.45',
            false,
            2
        );

        // Check if result is an object and has a path property
        result.should.have.property('path');

        // Ensure the path contains the expected ssgId
        const expectedSsgId = '34a6556f-579b-4f32-a78d-c0444519ecfe';
        result._parts.path.includes(`security_guides/${expectedSsgId}`).should.be.true;

        // Make sure the HTTP request was made once
        http.callCount.should.equal(1);
        const options = http.args[0][0];
        options.headers.should.have.size(2); // Ensure headers were passed
        options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
        options.headers.should.have.property('x-rh-identity', 'identity');
    });

    test('correctly builds the ssgUri with the filter in the buildV2Uri function', async function () {
        const expectedUri = 'http://compliance-backend.compliance-ci.svc.cluster.local:3000/api/compliance/v2/security_guides?filter=ref_id%3Dxccdf_org.ssgproject.content_benchmark_RHEL-8+AND+version%3D0.0.0';
        const http = base.getSandbox().stub(request, 'run').callsFake(params => {
            params.uri.should.equal(expectedUri);
            return Promise.resolves({
                statusCode: 200,
                body: {
                    data: [
                        {
                            id: '34a6556f-579b-4f32-a78d-c0444519ecfe',
                            type: 'security_guide',
                            attributes: {
                                title: 'RHEL 8 Security Guide',
                                ref_id: 'xccdf_org.ssgproject.content_benchmark_RHEL-8',
                                version: '0.1.45'
                            }
                        }
                    ]
                },
                headers: {}
            });
        });

        http.resolves({
            statusCode: 200,
            body: {
                data: {
                    id: 'e57953ac-4211-422d-bcaa-abebc42593f5',
                    type: 'rule',
                    attributes: {
                        ref_id: 'xccdf_org.ssgproject.content_rule_sshd_disable_root_login',
                        title: 'Disable SSH Root Login',
                        rationale: 'Even though the communications channel may be encrypted, an additional layer of security is gained by extending the policy of not logging directly on as root.',
                        description: 'The root user should never be allowed to login to a system directly over a network.',
                        severity: 'Medium',
                        total_systems_count: 0,
                        affected_systems_count: 4
                    }
                }
            },
            headers: {}
        });

        await impl.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login', 'xccdf_org.ssgproject.content_benchmark_RHEL-8', '0.0.0');
        http.callCount.should.equal(2);
    });
});
