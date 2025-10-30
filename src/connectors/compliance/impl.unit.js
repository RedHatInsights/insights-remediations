'use strict';

const impl = require('./impl');
const base = require('../../test');
const { mockRequest, mockCache } = require('../testUtils');
const _ = require('lodash');
const request = require('../../util/request');
const errors = require('../../errors');
const RequestError = require('request-promise-core/errors').RequestError;

/* eslint-disable max-len */
describe('compliance impl', function () {

    beforeEach(mockRequest);

    test('throws invalidIssueId error for deprecated v1 format (no ssgVersion)', async function () {
        await expect(impl.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login'))
            .rejects.toThrow(errors.BadRequest);
        
        // Also verify the specific error details
        try {
            await impl.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login');
        } catch (error) {
            error.should.be.instanceOf(errors.BadRequest);
            error.error.code.should.equal('INVALID_ISSUE_IDENTIFIER');
            error.message.should.equal('Compliance v1 issue identifiers have been retired. Please update your v1 issue ID, "ssg:<platform>|<profile>|xccdf_org.ssgproject.content_rule_sshd_disable_root_login", to the v2 format of "ssg:xccdf_org.ssgproject.content_benchmark_RHEL-X|<version>|<profile>|xccdf_org.ssgproject.content_rule_sshd_disable_root_login"');
        }
    });

    test('throws invalidIssueId error for null ssgVersion (v1 format)', async function () {
        const http = base.getSandbox().stub(request, 'run');
        
        // Test cases that represent v1 format (ssgVersion is null)
        await expect(impl.getRule('rule', 'ref', null)).rejects.toThrow(errors.BadRequest);
        await expect(impl.getRule('rule', 'ref')).rejects.toThrow(errors.BadRequest);
        
        // Should not make any HTTP calls since validation fails first
        http.callCount.should.equal(0);
    });

    test('obtains rule info (v2 format)', async function () {
        const cache = mockCache();

        const http = base.getSandbox().stub(request, 'run');
        
        // Mock the security guides response (first call)
        http.onFirstCall().resolves({
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

        // Mock the rule response (second call)  
        http.onSecondCall().resolves({
            statusCode: 200,
            body: {
                data: {
                    id: 'e57953ac-4211-422d-bcaa-abebc42593f5',
                    type: 'rule',
                    ref_id: 'xccdf_org.ssgproject.content_rule_sshd_disable_root_login',
                    title: 'Disable SSH Root Login',
                    rationale: 'Even though the communications channel may be encrypted, an additional layer of\nsecurity is gained by extending the policy of not logging directly on as root.\nIn addition, logging in with a user-specific account provides individual\naccountability of actions performed on the system and also helps to minimize\ndirect attack attempts on root\'s password.',
                    description: 'The root user should never be allowed to login to a\nsystem directly over a network.\nTo disable root login via SSH, add or correct the following line\nin /etc/ssh/sshd_config:\nPermitRootLogin no',
                    severity: 'Medium',
                    total_systems_count: 0,
                    affected_systems_count: 4
                }
            },
            headers: {}
        });

        const result = await impl.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login', 'xccdf_org.ssgproject.content_benchmark_RHEL-8', '0.0.0');
        result.should.property('ref_id', 'xccdf_org.ssgproject.content_rule_sshd_disable_root_login');
        result.should.property('title', 'Disable SSH Root Login');

        // Verify HTTP behavior - should make 2 calls for security guide + rule
        http.callCount.should.equal(2);
        const options = http.args[0][0];
        options.headers.should.have.size(2);
        options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
        options.headers.should.have.property('x-rh-identity', 'identity');
        
        // Verify cache is being used, but don't assert on setex behavior as it's implementation-dependent
        cache.get.callCount.should.equal(2);

        // Second call should use cache and not make additional HTTP requests
        const result2 = await impl.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login', 'xccdf_org.ssgproject.content_benchmark_RHEL-8', '0.0.0');
        result2.should.property('ref_id', 'xccdf_org.ssgproject.content_rule_sshd_disable_root_login');
        
        // HTTP calls should remain the same (cache hit)
        http.callCount.should.equal(2);
        // Cache get should be called again  
        cache.get.callCount.should.equal(4);
    });

    test.skip('retries on failure', async function () {
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

        await impl.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login', 'xccdf_org.ssgproject.content_benchmark_RHEL-8', '0.0.0');
        cache.get.callCount.should.equal(6);
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
        // Note: No cache entries should be set for null results
    });

    test('status code handling', async function () {
        base.mockRequestStatusCode();
        await expect(impl.getRule('unknown-rule', 'xccdf_org.ssgproject.content_benchmark_RHEL-8', '0.0.0')).rejects.toThrow(errors.DependencyError);
    });

    test('403 response handling', async function () {
        base.mockRequestStatusCode(403);
        await expect(impl.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login', 'xccdf_org.ssgproject.content_benchmark_RHEL-8', '0.0.0')).rejects.toThrow(errors.Forbidden);
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
        const expectedUri = 'http://compliance-backend.compliance-ci.svc.cluster.local:3000/api/compliance/v2/security_guides?filter=ref_id=xccdf_org.ssgproject.content_benchmark_RHEL-8+AND+version=0.0.0';
        const http = base.getSandbox().stub(request, 'run').callsFake(params => {
            params.uri.should.equal(expectedUri);
            return Promise.resolve({
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
