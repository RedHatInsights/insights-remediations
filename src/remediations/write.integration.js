'use strict';

const _ = require('lodash');
const config = require('../config');
const rbac = require('../connectors/rbac');
const { request, reqId, auth, getSandbox, buildRbacResponse } = require('../test');
const { NON_EXISTENT_SYSTEM } = require('../connectors/inventory/mock');
const uuid = require('uuid');
const db = require('../db');

function testIssue (remediation, id, resolution, systems) {
    const issue = _.find(remediation.issues, {id});
    issue.resolution.id.should.equal(resolution);
    issue.systems.should.have.length(systems.length);
    issue.systems.map(system => system.id).should.containDeep(systems);
}

function deletePlanByName (plan_name, owner = auth.testWrite) {
    // Find plan by nam
    const delete_request = request.get(`/v1/remediations?filter=${plan_name}`)
    .set(owner)
    .then(async result => {
        const id = _.get(result, 'body.data[0].id');

        // delete existing plan
        if (id) {
            return await request.delete(`/v1/remediations/${id}`).set(owner);
        }

        return result;
    });

    return delete_request;
}

async function createPlan (plan_name, issues, systems, owner = auth.testWrite) {
    const r1 = await request
    .post('/v1/remediations')
    .set(owner)
    .send({
        name: plan_name,
        add: {
            issues,
            systems
        }
    })
    .expect(201);

    r1.body.should.have.size(1);
    r1.body.should.have.property('id');

    return r1.body.id;
}

const issues = [
    {id: 'advisor:bond_config_issue|NO_QUOTES'},
    {id: 'advisor:bond_config_issue|EXTRA_WHITESPACE'},
    {id: 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074', resolution: 'selinux_mitigate'},
    {id: 'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE'}
];

const systems = [
    '56db4b54-6273-48dc-b0be-41eb4dc87c7f',
    'f5ce853a-c922-46f7-bd82-50286b7d8459',
    '2e9c9324-d42f-461f-b35f-706e667e713a',
    '7f3d9680-c7dc-4c63-911b-c7037c19214c',
    'b72c7d02-7a97-4189-9a63-2c45232b8f7a',
    '82d28ead-411f-4561-b934-906f1eebba1b'
];

describe('remediations', function () {
    describe('create', function () {
        test('creates a new remediation', async () => {
            const name = 'remediation';

            const r1 = await request
            .post('/v1/remediations')
            .set(auth.testWrite)
            .send({name})
            .expect(201);

            r1.body.should.have.size(1);
            r1.body.should.have.property('id');
            const location = r1.header.location;
            location.should.match(
                // eslint-disable-next-line security/detect-non-literal-regexp
                new RegExp(`^${config.path.base}/v1/remediations/[\\w]{8}-[\\w]{4}-[\\w]{4}-[\\w]{4}-[\\w]{12}$`));

            const r2 = await request
            // strip away the base path as request already counts with that
            .get(location.replace(config.path.base, ''))
            .set(auth.testWrite)
            .expect(200);

            r2.body.should.have.property('id', r1.body.id);
            r2.body.should.have.property('name', name);
        });

        test('creates a new remediation (2)', async () => {
            const name = 'remediation with auto reboot suppressed';

            const r1 = await request
            .post('/v1/remediations')
            .set(auth.testWrite)
            .send({name, auto_reboot: false})
            .expect(201);

            r1.body.should.have.size(1);
            r1.body.should.have.property('id');

            const r2 = await request
            .get(`/v1/remediations/${r1.body.id}`)
            .set(auth.testWrite)
            .expect(200);

            r2.body.should.have.property('auto_reboot', false);
        });

        test('creates a new remediation (anemic tenant)', async () => {
            const name = 'remediation';

            const r1 = await request
                .post('/v1/remediations')
                .set(auth.anemicTenant)
                .send({name})
                .expect(201);

            r1.body.should.have.size(1);
            r1.body.should.have.property('id');
            const location = r1.header.location;
            location.should.match(
                // eslint-disable-next-line security/detect-non-literal-regexp
                new RegExp(`^${config.path.base}/v1/remediations/[\\w]{8}-[\\w]{4}-[\\w]{4}-[\\w]{4}-[\\w]{12}$`));

            const r2 = await request
                // strip away the base path as request already counts with that
                .get(location.replace(config.path.base, ''))
                .set(auth.anemicTenant)
                .expect(200);

            r2.body.should.have.property('id', r1.body.id);
            r2.body.should.have.property('name', name);
        });

        test('400s on weird remediation name', async () => {
            const {id, header} = reqId();
            const {body} = await request
            .post('/v1/remediations')
            .set(header)
            .set(auth.testWrite)
            .send({name: '  :-) !!! \\-/'})
            .expect(400);

            body.errors.should.eql([{
                id,
                status: 400,
                code: 'pattern.openapi.requestValidation',
                title: 'must match pattern \"^(?!\\s).+(?<!\\s)$\" (location: body, path: name)'
            }]);
        });

        test('creates a new remediation with issues', async () => {
            const name = 'new remediation with issues';
            const systems = ['56db4b54-6273-48dc-b0be-41eb4dc87c7f', 'f5ce853a-c922-46f7-bd82-50286b7d8459'];

            const r1 = await request
            .post('/v1/remediations')
            .set(auth.testWrite)
            .send({
                name,
                add: {
                    issues: [{
                        id: 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
                        resolution: 'selinux_mitigate'
                    }, {
                        id: 'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE'
                    }],
                    systems
                }
            })
            .expect(201);

            r1.body.should.have.size(1);
            r1.body.should.have.property('id');

            const location = r1.header.location;
            location.should.match(
                // eslint-disable-next-line security/detect-non-literal-regexp
                new RegExp(`^${config.path.base}/v1/remediations/[\\w]{8}-[\\w]{4}-[\\w]{4}-[\\w]{4}-[\\w]{12}$`));

            const r2 = await request
            // strip away the base path as request already counts with that
            .get(location.replace(config.path.base, ''))
            .set(auth.testWrite)
            .expect(200);

            r2.body.should.have.property('id', r1.body.id);
            r2.body.should.have.property('name', name);
            r2.body.issues.should.have.length(2);

            testIssue(r2.body, 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074', 'selinux_mitigate', systems);
            testIssue(r2.body, 'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE', 'fix', systems);
        });

        test('creates a new remediation with 20k systems', async () => {
            const name = `new remediation with issues 2`;
            const systems = _.times(20000, () => uuid.v4());

            const {body: {id}} = await request
            .post('/v1/remediations')
            .set(auth.testWrite)
            .send({
                name,
                add: {
                    issues: [{
                        id: 'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE'
                    }],
                    systems
                }
            })
            .expect(201);

            const {body} = await request
            .get(`/v1/remediations`)
            .set(auth.testWrite)
            .expect(200);

            const remediation = _.find(body.data, {id});
            (remediation !== undefined).should.be.true();
            remediation.system_count.should.equal(20000);
        });

        test('creates a new remediation with Compliance issues', async () => {
            const name = 'new remediation with Compliance issues';
            const systems = ['56db4b54-6273-48dc-b0be-41eb4dc87c7f', 'f5ce853a-c922-46f7-bd82-50286b7d8459'];
            const issueId = 'ssg:xccdf_org.ssgproject.content_benchmark_RHEL-7|1.0.0|pci-dss|xccdf_org.ssgproject.content_rule_disable_prelink';

            const r1 = await request
            .post('/v1/remediations')
            .set(auth.testWrite)
            .send({
                name,
                add: {
                    issues: [{ id: issueId }],
                    systems
                }
            })
            .expect(201);

            r1.body.should.have.property('id');
            const remediationId = r1.body.id;

            const { body: remediation } = await request
            .get(`/v1/remediations/${remediationId}`)
            .set(auth.testWrite)
            .expect(200);

            remediation.should.have.property('id', remediationId);
            remediation.should.have.property('issues').which.is.an.Array().and.has.length(1);

            const issue = remediation.issues[0];
            issue.should.have.property('id', issueId);
            issue.should.have.property('resolution');
            issue.systems.map(system => system.id).should.eql(systems);
        });


        test('400s if unexpected property is provided', async () => {
            const {id, header} = reqId();

            const {body} = await request
            .post('/v1/remediations')
            .set(header)
            .set(auth.testWrite)
            .send({
                name: 'foo',
                foo: 'bar'
            })
            .expect(400);

            body.errors.should.eql([{
                id,
                status: 400,
                code: 'additionalProperties.openapi.requestValidation',
                title: 'must NOT have additional properties (location: body, path: undefined)'
            }]);
        });

        test('400s on post with invalid json body format', async () => {
            const {header} = reqId();

            const {body} = await request
            .post('/v1/remediations')
            .set(header)
            .set(auth.testWrite)
            .type('json')
            .send('<test>xml is not allowed</test>')
            .expect(400);

            body.errors.should.eql([{
                id: 'unknown',
                status: 400,
                code: 'INVALID_CONTENT_TYPE',
                title: 'The request body must be in JSON format.'
            }]);
        });

        test('400s on post with xml content-type', async () => {
            const {id, header} = reqId();

            const {body} = await request
            .post('/v1/remediations')
            .set(header)
            .set(auth.testWrite)
            .type('application/xml')
            .send('<test>xml is not allowed</test>')
            .expect(400);

            body.errors.should.eql([{
                id,
                status: 400,
                code: 'VALIDATION_ERROR',
                title: 'Unsupported Content-Type application/xml (location: undefined, path: undefined)'
            }]);
        });

        test('400s when remediation is created with name that is used by existing remediation created by the same user', async () => {
            const name = 'duplicate name and same user for create';
            const {id, header} = reqId();

            const r1 = await request
            .post('/v1/remediations')
            .set(header)
            .set(auth.testWrite)
            .send({name})
            .expect(201);

            const {body} = await request
            .post('/v1/remediations')
            .set(header)
            .set(auth.testWrite)
            .send({name})
            .expect(400);

            body.errors.should.eql([{
                id,
                status: 400,
                code: 'SequelizeUniqueConstraintError',
                title: 'Remediation name must be unique within organization. duplicate name and same user for create already exists within org 3333333.'
            }]);
        });

        test('400s when remediation is created with name used by existing remediation created by a different user within the same org', async () => {
            const name = 'duplicate name and different users within the same org for create';
            const {id, header} = reqId();

            const r1 = await request
            .post('/v1/remediations')
            .set(header)
            .set(auth.testWrite2)
            .send({name})
            .expect(201);

            const {body} = await request
            .post('/v1/remediations')
            .set(header)
            .set(auth.testWrite)
            .send({name})
            .expect(400);

            body.errors.should.eql([{
                id,
                status: 400,
                code: 'SequelizeUniqueConstraintError',
                title: 'Remediation name must be unique within organization. duplicate name and different users within the same org for create already exists within org 3333333.'
            }]);
        });

        test('201s when remediation is created with name used by existing remediation created by a different user in a different org', async () => {
            const name = 'duplicate name and different users in different orgs for create';
            const {id, header} = reqId();

            const r1 = await request
            .post('/v1/remediations')
            .set(header)
            .set(auth.testWrite3)
            .send({name})
            .expect(201);

            const r2 = await request
            .post('/v1/remediations')
            .set(header)
            .set(auth.testWrite)
            .send({name})
            .expect(201);
        });

        test.skip('400s when remediation plan name has leading/trailing whitespace', async () => {
            const name_1 = ' duplicate plan for whitespace test';
            const name_2 = 'duplicate plan for whitespace test ';
            const {id, header} = reqId();

            const {body: body_1} = await request
                .post('/v1/remediations')
                .set(header)
                .set(auth.testWrite)
                .send({name: name_1})
                .expect(400);

            body_1.errors.should.eql([{
                id,
                status: 400,
                code: 'pattern.openapi.requestValidation',
                title: 'must match pattern \"^(?!\\s).+(?<!\\s)$\" (location: body, path: name)'
            }]);

            const {body: body_2} = await request
                .post('/v1/remediations')
                .set(header)
                .set(auth.testWrite)
                .send({name: name_2})
                .expect(400);

            body_2.errors.should.eql([{
                id,
                status: 400,
                code: 'pattern.openapi.requestValidation',
                title: 'must match pattern \"^(?!\\s).+(?<!\\s)$\" (location: body, path: name)'
            }]);
        });

        test('400s when remediation name is set to empty string', async () => {
            const name = '';
            const {id, header} = reqId();

            const {body} = await request
            .post('/v1/remediations')
            .set(header)
            .set(auth.testWrite)
            .send({name})
            .expect(400);

            body.errors.should.eql([{
                id,
                status: 400,
                code: 'pattern.openapi.requestValidation',
                title: 'must match pattern \"^(?!\\s).+(?<!\\s)$\" (location: body, path: name)'
            }]);
        });

        test('400s when remediation name is set to null', async () => {
            const name = null;
            const {id, header} = reqId();

            const {body} = await request
            .post('/v1/remediations')
            .set(header)
            .set(auth.testWrite)
            .send({name})
            .expect(400);

            body.errors.should.eql([{
                id,
                status: 400,
                code: 'type.openapi.requestValidation',
                title: 'must be string (location: body, path: name)'
            }]);
        });

        test('400s when remediation name is undefined upon creation', async () => {
            const {id, header} = reqId();

            const {body} = await request
            .post('/v1/remediations')
            .set(header)
            .send({auto_reboot: false})
            .set(auth.testWrite)
            .expect(400);

            body.errors.should.eql([{
                id,
                status: 400,
                code: 'SequelizeValidationError',
                title: 'Remediation name cannot be null.'
            }]);
        });
    });

    describe('update', function () {
        describe('remediation', function () {
            test('adding actions to empty remediation', async () => {
                const url = '/v1/remediations/3c1877a0-bbcd-498a-8349-272129dc0b88';
                const systems = ['56db4b54-6273-48dc-b0be-41eb4dc87c7f', 'f5ce853a-c922-46f7-bd82-50286b7d8459'];

                await request
                .patch(url)
                .send({
                    add: {
                        issues: [{
                            id: 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
                            resolution: 'selinux_mitigate'
                        }, {
                            id: 'vulnerabilities:CVE-2017-15126',
                            systems: ['9611764a-8346-4b4c-a0da-2764553f8448']
                        }],
                        systems
                    }
                })
                .set(auth.testWrite)
                .expect(200);

                const {body} = await request
                .get(url)
                .set(auth.testWrite)
                .expect(200);

                body.issues.should.have.length(2);
                testIssue(body, 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074', 'selinux_mitigate', systems);
                testIssue(body, 'vulnerabilities:CVE-2017-15126', 'fix', ['9611764a-8346-4b4c-a0da-2764553f8448']);
            });

            test('adding actions to existing remediation', async () => {
                const url = '/v1/remediations/05860f91-4bc4-4bcf-9e5d-a6db6041ae76';
                const systems = ['56db4b54-6273-48dc-b0be-41eb4dc87c7f', 'f5ce853a-c922-46f7-bd82-50286b7d8459'];
                const defaultSystems = ['1bada2ce-e379-4e17-9569-8a22e09760af', '6749b8cf-1955-42c1-9b48-afc6a0374cd6'];

                await request
                .patch(url)
                .send({
                    add: {
                        issues: [{
                            id: 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
                            resolution: 'selinux_mitigate'
                        }, {
                            id: 'vulnerabilities:CVE-2017-5715',
                            systems: ['9611764a-8346-4b4c-a0da-2764553f8448']
                        }, {
                            id: 'vulnerabilities:CVE-2017-15126',
                            systems: ['9611764a-8346-4b4c-a0da-2764553f8448']
                        }],
                        systems
                    }
                })
                .set(auth.testWrite)
                .expect(200);

                const {body} = await request
                .get(url)
                .set(auth.testWrite)
                .expect(200);

                body.issues.should.have.length(3);
                testIssue(body, 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074', 'selinux_mitigate', [
                    ...systems,
                    ...defaultSystems
                ]);

                testIssue(body, 'vulnerabilities:CVE-2017-15126', 'fix', ['9611764a-8346-4b4c-a0da-2764553f8448']);
                testIssue(body, 'vulnerabilities:CVE-2017-5715', 'fix', [
                    '9611764a-8346-4b4c-a0da-2764553f8448',
                    ...defaultSystems
                ]);
            });

            describe('validation', function () {
                const url = '/v1/remediations/466fc274-16fe-4239-a648-2083ed2e05b0';

                let id;
                let header;
                beforeEach(() => ({id, header} = reqId()));
                afterEach(() => id = header = null);

                function sendPatch(payload) {
                    return request
                    .patch(url)
                    .set(header)
                    .send(payload)
                    .set(auth.testWrite)
                    .expect(400);
                }

                test('400s on invalid system identifier', async () => {
                    const {body} = await sendPatch({
                        add: {
                            issues: [{
                                id: 'vulnerabilities:CVE-2017-5715',
                                systems: ['04f79296-82ff-4806-9f70-df15a5b60d47', NON_EXISTENT_SYSTEM]
                            }]
                        }
                    });

                    body.errors.should.eql([{
                        id,
                        status: 400,
                        code: 'UNKNOWN_SYSTEM',
                        title: `Unknown system identifier "${NON_EXISTENT_SYSTEM}"`
                    }]);
                });

                test('400s on invalid issue identifier', async () => {
                    const {body} = await sendPatch({
                        add: {
                            issues: [{
                                id: 'advisor:non-existent-issue',
                                systems: ['04f79296-82ff-4806-9f70-df15a5b60d47']
                            }]
                        }
                    });

                    body.errors.should.eql([{
                        id,
                        status: 400,
                        code: 'UNSUPPORTED_ISSUE',
                        title: 'Issue "advisor:non-existent-issue" does not have Ansible support'
                    }]);
                });

                test('400s on invalid issue resolution identifier', async () => {
                    const {body} = await sendPatch({
                        add: {
                            issues: [{
                                id: 'vulnerabilities:CVE-2017-5715',
                                systems: ['04f79296-82ff-4806-9f70-df15a5b60d47'],
                                resolution: 'non-existent-resolution'
                            }]
                        }
                    });

                    body.errors.should.eql([{
                        id,
                        status: 400,
                        code: 'UNKNOWN_RESOLUTION',
                        title: 'Issue "vulnerabilities:CVE-2017-5715" does not have Ansible resolution "non-existent-resolution"'
                    }]);
                });

                test('400s if no systems are provided', async () => {
                    const {body} = await sendPatch({
                        add: {
                            issues: [{
                                id: 'vulnerabilities:CVE-2017-5715',
                                resolution: 'fix'
                            }]
                        }
                    });

                    body.errors.should.eql([{
                        id,
                        status: 400,
                        code: 'NO_SYSTEMS',
                        title: 'Systems not specified for "vulnerabilities:CVE-2017-5715"'
                    }]);
                });

                test('400s if issue identifier is missing', async () => {
                    const {body} = await sendPatch({
                        add: {
                            issues: [{
                                systems: ['04f79296-82ff-4806-9f70-df15a5b60d47'],
                                resolution: 'fix'
                            }]
                        }
                    });

                    body.errors.should.eql([{
                        id,
                        status: 400,
                        code: 'required.openapi.requestValidation',
                        title: 'must have required property \'id\' (location: body, path: add.issues.0.id)'
                    }]);
                });

                test('400s if empty list passed into add.issues', async () => {
                    const {body} = await sendPatch({
                        add: {
                            issues: []
                        }
                    });

                    body.errors.should.eql([{
                        id,
                        status: 400,
                        code: 'minItems.openapi.requestValidation',
                        title: 'must NOT have fewer than 1 items (location: body, path: add.issues)'
                    }]);
                });

                test('400s if an issue is specified more than once', async () => {
                    const {body} = await sendPatch({
                        add: {
                            issues: [{
                                id: 'vulnerabilities:CVE-2017-5715',
                                systems: ['1a53c38c-2f62-4dde-a16e-60bb29aca334']
                            }, {
                                id: 'vulnerabilities:CVE-2017-5715',
                                systems: ['d77db1cb-fdec-40cf-a9b4-e0a9308ec072']
                            }]
                        }
                    });

                    body.errors.should.eql([{
                        id,
                        status: 400,
                        code: 'DUPLICATE_ISSUE',
                        title: 'Issue "vulnerabilities:CVE-2017-5715" specified more than once in the issue list'
                    }]);
                });

                test('404s on invalid remediation id', async () => {
                    await request
                    .patch('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d1508a02')
                    .send({
                        add: {
                            issues: [{
                                id: 'vulnerabilities:CVE-2017-5715',
                                systems: ['04f79296-82ff-4806-9f70-df15a5b60d47']
                            }]
                        }
                    })
                    .set(auth.testWrite)
                    .expect(404);
                });

                test('400s on empty request', async () => {
                    const {body} = await sendPatch({});

                    body.errors.should.eql([{
                        id,
                        status: 400,
                        code: 'EMPTY_REQUEST',
                        title: 'At least one of "add", "name", "auto_reboot", "archived" needs to be specified'
                    }]);
                });

                test('400s when remediation is renamed to name that is used by existing remediation created by the same user', async () => {
                    const name = 'duplicate name and same user';
                    const {id, header} = reqId();

                    await request
                    .post('/v1/remediations')
                    .set(auth.testWrite)
                    .send({name});

                    const url = '/v1/remediations/8b427145-ac9f-4727-9543-76eb140222cd';

                    const {body} = await request
                    .patch(url)
                    .set(header)
                    .send({name})
                    .set(auth.testWrite)
                    .expect(400);

                    body.errors.should.eql([{
                        id,
                        status: 400,
                        code: 'SequelizeUniqueConstraintError',
                        title: 'Remediation name must be unique within organization. duplicate name and same user already exists within org 3333333.'
                    }]);
                });

                test('400s when remediation is renamed to a name used by existing remediation created by a different user within the same org', async () => {
                    const name = 'duplicate name and different users within the same org';
                    const {id, header} = reqId();

                    const r1 = await request
                    .post('/v1/remediations')
                    .set(auth.testWrite2)
                    .send({name});

                    const url = '/v1/remediations/8b427145-ac9f-4727-9543-76eb140222cd';

                    const {body} = await request
                    .patch(url)
                    .set(header)
                    .send({name})
                    .set(auth.testWrite)
                    .expect(400);

                    body.errors.should.eql([{
                        id,
                        status: 400,
                        code: 'SequelizeUniqueConstraintError',
                        title: 'Remediation name must be unique within organization. duplicate name and different users within the same org already exists within org 3333333.'
                    }]);
                });

                test('200s when remediation is renamed to a name used by existing remediation created by a different user within a different org', async () => {
                    const name = 'duplicate name and different users within different orgs';
                    const {id, header} = reqId();

                    const r1 = await request
                    .post('/v1/remediations')
                    .set(auth.testWrite3)
                    .send({name});

                    const url = '/v1/remediations/8b427145-ac9f-4727-9543-76eb140222cd';

                    const {body} = await request
                    .patch(url)
                    .set(header)
                    .send({name})
                    .set(auth.testWrite)
                    .expect(200);
                });

                test('400s when remediation name is updated to empty string', async () => {
                    const name = '';
                    const {id, header} = reqId();

                    const url = '/v1/remediations/8b427145-ac9f-4727-9543-76eb140222cd';

                    const {body} = await request
                    .patch(url)
                    .set(header)
                    .send({name})
                    .set(auth.testWrite)
                    .expect(400);

                    body.errors.should.eql([{
                        id,
                        status: 400,
                        code: 'pattern.openapi.requestValidation',
                        title: 'must match pattern \"^(?!\\s).+(?<!\\s)$\" (location: body, path: name)'
                    }]);
                });

                test('400s when remediation name is updated to null', async () => {
                    const {id, header} = reqId();

                    const url = '/v1/remediations/8b427145-ac9f-4727-9543-76eb140222cd';

                    const {body} = await request
                    .patch(url)
                    .set(header)
                    .send({
                        name: null
                    })
                    .set(auth.testWrite)
                    .expect(400);

                    body.errors.should.eql([{
                        id,
                        status: 400,
                        code: 'type.openapi.requestValidation',
                        title: 'must be string (location: body, path: name)'
                    }]);
                });

                test('200s when remediation name is undefined during update', async () => {
                    const {id, header} = reqId();

                    const url = '/v1/remediations/8b427145-ac9f-4727-9543-76eb140222cd';

                    const {body} = await request
                    .patch(url)
                    .set(header)
                    .send({auto_reboot: false, archived: true})
                    .set(auth.testWrite)
                    .expect(200);
                });
            });

            describe('properties', function () {
                test('give new name, suppress auto reboot, and set archived for remediation', async () => {
                    const url = '/v1/remediations/8b427145-ac9f-4727-9543-76eb140222cd';
                    const name = 'renamed remediation';

                    await request
                    .patch(url)
                    .send({name, auto_reboot: false, archived: true})
                    .set(auth.testWrite)
                    .expect(200);

                    const {body} = await request
                    .get(url)
                    .set(auth.testWrite)
                    .expect(200);

                    body.name.should.equal(name);
                    body.auto_reboot.should.equal(false);
                    body.archived.should.equal(true);
                });
            });
        });

        describe('issue', function () {
            test('resolution', async () => {
                const id = '/v1/remediations/022e01be-74f1-4893-b48c-df429fe7d09f' +
                    '/issues/advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074';

                await request
                .patch(id)
                .send({
                    resolution: 'selinux_mitigate'
                })
                .set(auth.testWrite)
                .expect(200);

                const {body} = await request
                .get('/v1/remediations/022e01be-74f1-4893-b48c-df429fe7d09f')
                .set(auth.testWrite)
                .expect(200);

                const issue = _.find(body.issues, { id: 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074' });
                issue.resolution.should.have.property('id', 'selinux_mitigate');
            });

            test('400s on unknown resolution id', async () => {
                const {id, header} = reqId();

                const {body} = await request
                .patch('/v1/remediations/022e01be-74f1-4893-b48c-df429fe7d09f/issues/vulnerabilities:CVE-2017-5715')
                .set(header)
                .send({
                    resolution: 'foobar'
                })
                .set(auth.testWrite)
                .expect(400);

                body.errors.should.eql([{
                    id,
                    status: 400,
                    code: 'UNKNOWN_RESOLUTION',
                    title: 'Issue "vulnerabilities:CVE-2017-5715" does not have Ansible resolution "foobar"'
                }]);
            });

            test('400s on unknown issue id', async () => {
                await request
                .patch('/v1/remediations/022e01be-74f1-4893-b48c-df429fe7d09f/issues/vulnerabilities:foo')
                .send({
                    resolution: 'fix'
                })
                .set(auth.testWrite)
                .expect(400);
            });

            test('404s on unknown remediation id', async () => {
                await request
                .patch('/v1/remediations/6b491f9e-70ef-445b-8178-a173dddbbb96/issues/vulnerabilities:CVE-2017-5715')
                .send({
                    resolution: 'fix'
                })
                .set(auth.testWrite)
                .expect(404);
            });
        });
    });

    describe('delete', function () {
        test('single plan', async () => {
            await request
            .delete('/v1/remediations/3d34ed5c-a71f-48ee-b7af-b215f27ae68d')
            .set(auth.testWrite)
            .expect(204);

            await request
            .delete('/v1/remediations/3d34ed5c-a71f-48ee-b7af-b215f27ae68d')
            .set(auth.testWrite)
            .expect(404);
        });

        describe('bulk plan', () => {
            test('invalid IDs', async () => {
                const { body } = await request
                .delete('/v1/remediations')
                .send({
                    remediation_ids: [
                        'cecf1e86-f1c0-4dd7-81b6-8798deadbeef', // <-- bad id
                        'c11b0d3e-6b0d-4dd6-a531-12121afd3ec0',
                        '4270c407-12fb-4a69-b4e8-588fdc0bcdf3',
                        '756e2b13-f27c-4d71-a9ea-005255924181', // <-- bad id
                        '329a22fe-fc63-4700-9e4d-e9b92d6e2b54'
                    ]
                })
                .set(auth.testBulk)
                .expect(200);

                body.deleted_count.should.equal(3);
            });

            test('wrong user', async () => {
                const { body } = await request
                .delete('/v1/remediations')
                .send({
                    remediation_ids: [
                        '1f600784-947d-4883-a364-c59ec9d3ec00', // <-- only this belongs to testWrite
                        'a91aedb0-4856-47c7-85d7-4725fb3f9262',
                        'e96a2346-8e37-441d-963a-c2eed3ee856a',
                        '301653a2-4b5f-411c-8cb5-a74a96e2f344',
                        '702d0f73-de15-4bfe-897f-125bd339fbb9'
                    ]
                })
                .set(auth.testWrite)
                .expect(200);

                body.deleted_count.should.equal(1);

                // check that testWrite's remediation was deleted
                await request
                    .get('/v1/remediations/1f600784-947d-4883-a364-c59ec9d3ec00')
                    .set(auth.testWrite)
                    .expect(404);

                // check that other remediations were not deleted
                await request
                    .get('/v1/remediations/a91aedb0-4856-47c7-85d7-4725fb3f9262')
                    .set(auth.testBulk)
                    .expect(200);
            });

            test('too many IDs', async () => {
                const id_count = 101;
                const res = await request
                .delete('/v1/remediations')
                .send({remediation_ids: Array.from({length: id_count}, () => {return 'c11b0d3e-6b0d-4dd6-a531-12121afd3ec0';})})
                .set(auth.testBulk)
                .expect(400);

                res.body.errors[0].id = ''; // id is different every time
                expect(res.body).toMatchSnapshot();
            });

            test('missing body', async () => {
                const res = await request
                .delete('/v1/remediations')
                .set('Content-Type', 'application/json')
                .set(auth.testBulk)
                .expect(400);

                res.body.errors[0].id = ''; // id is different every time..
                expect(res.body).toMatchSnapshot();
            });

            test('empty list', async () => {
                const res = await request
                .delete('/v1/remediations')
                .send({remediation_ids: []})
                .set(auth.testBulk)
                .expect(400);

                res.body.errors[0].id = ''; // id is different every time..
                expect(res.body).toMatchSnapshot();
            });

            test('repeated ids ok', async () => {
                const remediation_1 = '091d3d7a-0c58-4d4a-a8e5-d79ac4e9ee58',
                      remediation_2 = '85063be8-381e-4d38-aa2d-5400b2a6b0cc';

                const { body } = await request
                .delete('/v1/remediations')
                .send({
                    remediation_ids: [
                        remediation_1,
                        remediation_2,
                        remediation_1,
                        remediation_2
                    ]
                })
                .set(auth.testBulk)
                .expect(200);

                body.deleted_count.should.equal(2);

                await request
                .delete(`/v1/remediations/${remediation_1}`)
                .set(auth.testBulk)
                .expect(404);

                await request
                    .delete(`/v1/remediations/${remediation_2}`)
                    .set(auth.testBulk)
                    .expect(404);
            });

            test('bulk delete', async () => {
                await request
                    .get('/v1/remediations/cecf1e86-f1c0-4dd7-81b6-8798b2aa714c')
                    .set(auth.testBulk)
                    .expect(200);

                const { body } = await request
                .delete('/v1/remediations')
                .send({
                    remediation_ids: [
                        'cecf1e86-f1c0-4dd7-81b6-8798b2aa714c',
                        '32f0c7ed-dc9e-4425-b38d-e80a245dae84',
                        'fe3337ca-01cf-4b75-b65e-b14c61ecdaa7'
                    ]
                })
                .set(auth.testBulk)
                .expect(200);

                body.deleted_count.should.equal(3);

                await request
                .get('/v1/remediations/cecf1e86-f1c0-4dd7-81b6-8798b2aa714c')
                .set(auth.testBulk)
                .expect(404);
            });
        });

        test('issue', async () => {
            await request
            .delete('/v1/remediations/3274d99f-511d-4b05-9d88-69934f6bb8ec/issues/vulnerabilities:CVE-2017-5715')
            .set(auth.testWrite)
            .expect(204);

            await request
            .delete('/v1/remediations/3274d99f-511d-4b05-9d88-69934f6bb8ec/issues/vulnerabilities:CVE-2017-5715')
            .set(auth.testWrite)
            .expect(404);

            const {body} = await request
            .get('/v1/remediations/3274d99f-511d-4b05-9d88-69934f6bb8ec')
            .set(auth.testWrite)
            .expect(200);

            body.issues.should.have.length(1);
        });

        describe('bulk issues', () => {

            const name = 'bulk issue delete test';

            test('succeeds', async () => {
                // remove any existing plan
                await deletePlanByName(name, auth.testWrite);

                // Create remediation plan with 4 issues x 6 systems
                const plan_id = await createPlan(name, issues, systems);

                // bulk delete 3 issues
                const r1 = await request
                .delete(`/v1/remediations/${plan_id}/issues`)
                .set(auth.testWrite)
                .send({
                    issue_ids: [
                            'advisor:bond_config_issue|EXTRA_WHITESPACE',
                            'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
                            'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE'
                    ]
                })
                .expect(200);

                r1.body.should.have.size(1);
                r1.body.should.have.property('deleted_count');
                r1.body.deleted_count.should.equal(3);

                // validate plan contents
                const r2 = await request.get(`/v1/remediations/${plan_id}`).set(auth.testWrite);

                // different every time
                r2.body.id = '';
                r2.body.created_at = '';
                r2.body.updated_at = '';

                expect(r2.body).toMatchSnapshot();
            });

            test('returns 404 for missing plan', async () => {
                await request
                .delete(`/v1/remediations/1e65b8e0-d7f3-442d-826e-45e0bf603687/issues`)
                .set(auth.testWrite)
                .send({
                    issue_ids: ['advisor:bond_config_issue|EXTRA_WHITESPACE']
                })
                .expect(404);
            });

            test('returns 404 for wrong owner', async () => {
                // remove any existing plan
                await deletePlanByName(name, auth.testWrite);

                // Create remediation plan with 4 issues x 6 systems
                const plan_id = await createPlan(name, issues, systems, auth.testWrite);

                // bulk delete 3 issues
                await request
                .delete(`/v1/remediations/${plan_id}/issues`)
                .set(auth.testWrite2)
                .send({
                    issue_ids: [
                        'advisor:bond_config_issue|EXTRA_WHITESPACE',
                        'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
                        'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE'
                    ]
                })
                .expect(404);
            });

            test('ignores unknown issues', async () => {
                // remove any existing plan
                await deletePlanByName(name, auth.testWrite);

                // Create remediation plan with 4 issues x 6 systems
                const plan_id = await createPlan(name, issues, systems);

                // bulk delete 3 issues
                const r2 = await request
                .delete(`/v1/remediations/${plan_id}/issues`)
                .set(auth.testWrite)
                .send({
                    issue_ids: [
                        'advisor:bond_config_issue|EXTRA_WHITESPACE',
                        'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
                        'advisor:CVE_2025_1234_fictitious|FICTIONAL_CVE_2025_1234',
                        'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE'
                    ]
                })
                .expect(200);

                r2.body.should.have.size(1);
                r2.body.should.have.property('deleted_count');
                r2.body.deleted_count.should.equal(3);
            });

            test('ignores repeated issues', async () => {
                // remove any existing plan
                await deletePlanByName(name, auth.testWrite);

                // Create remediation plan with 4 issues x 6 systems
                const plan_id = await createPlan(name, issues, systems);

                // bulk delete 3 issues
                const r2 = await request
                .delete(`/v1/remediations/${plan_id}/issues`)
                .set(auth.testWrite)
                .send({
                    issue_ids: [
                        'advisor:bond_config_issue|EXTRA_WHITESPACE',
                        'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
                        'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE',
                        'advisor:bond_config_issue|EXTRA_WHITESPACE',
                        'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
                        'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE'
                    ]
                })
                .expect(200);

                r2.body.should.have.size(1);
                r2.body.should.have.property('deleted_count');
                r2.body.deleted_count.should.equal(3);
            });

            test('returns 400 for 0 issues', async () => {
                // remove any existing plan
                await deletePlanByName(name, auth.testWrite);

                // Create remediation plan with 4 issues x 6 systems
                const plan_id = await createPlan(name, issues, systems);

                // bulk delete 3 issues
                await request
                .delete(`/v1/remediations/${plan_id}/issues`)
                .set(auth.testWrite)
                .send({
                    issue_ids: []
                })
                .expect(400);
            });

            test('succeeds for exactly 100 issues', async () => {
                // remove any existing plan
                await deletePlanByName(name, auth.testWrite);

                // Create remediation plan with 4 issues x 6 systems
                const plan_id = await createPlan(name, issues, systems);

                // bulk delete 3 issues
                await request
                .delete(`/v1/remediations/${plan_id}/issues`)
                .set(auth.testWrite)
                .send({
                    issue_ids: Array(100).fill('advisor:bond_config_issue|EXTRA_WHITESPACE')
                })
                .expect(200);
            });

            test('returns 400 for more than 100 issues', async () => {
                // remove any existing plan
                await deletePlanByName(name, auth.testWrite);

                // Create remediation plan with 4 issues x 6 systems
                const plan_id = await createPlan(name, issues, systems);

                // bulk delete 3 issues
                await request
                .delete(`/v1/remediations/${plan_id}/issues`)
                .set(auth.testWrite)
                .send({
                    issue_ids: Array(101).fill('advisor:bond_config_issue|EXTRA_WHITESPACE')
                })
                .expect(400);
            });

            test('returns 400 for malformed issue', async () => {
                // remove any existing plan
                await deletePlanByName(name, auth.testWrite);

                // Create remediation plan with 4 issues x 6 systems
                const plan_id = await createPlan(name, issues, systems);

                // bulk delete 3 issues
                await request
                .delete(`/v1/remediations/${plan_id}/issues`)
                .set(auth.testWrite)
                .send({
                    issue_ids: [
                        'advisor:bond_config_issue|EXTRA_WHITESPACE',
                        'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
                        'advisor:CVE_2025_1234_fictitious|FICTIONAL_CVE_2025_1234',
                        'malformed issue',
                        'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE'
                    ]
                })
                .expect(400);
            });

            test('returns 400 for malformed plan id', async () => {
                // bulk delete 3 issues
                await request
                .delete(`/v1/remediations/invalid_plan_id/issues`)
                .set(auth.testWrite)
                .send({
                    issue_ids: [
                        'advisor:bond_config_issue|EXTRA_WHITESPACE',
                        'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
                        'advisor:CVE_2025_1234_fictitious|FICTIONAL_CVE_2025_1234',
                        'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE'
                    ]
                })
                .expect(400);
            });
        });

        test('system', async () => {
            const url = '/v1/remediations/869dccf6-19f1-4c2e-9025-e5b8d9e0faef/issues/vulnerabilities:CVE-2017-5715/' +
                'systems/1bada2ce-e379-4e17-9569-8a22e09760af';

            await request
            .delete(url)
            .set(auth.testWrite)
            .expect(204);

            await request
            .delete(url)
            .set(auth.testWrite)
            .expect(404);

            const {body} = await request
            .get('/v1/remediations/869dccf6-19f1-4c2e-9025-e5b8d9e0faef')
            .set(auth.testWrite)
            .expect(200);

            const issue = _.find(body.issues, {id: 'vulnerabilities:CVE-2017-5715'});
            issue.systems.should.have.length(1);
            issue.systems[0].id.should.equal('6749b8cf-1955-42c1-9b48-afc6a0374cd6');
        });

        describe('bulk systems', () => {
            const name_1 = 'bulk system delete test 1';
            const name_2 = 'bulk system delete test 2';

            test('succeeds', async () => {
                // remove any existing plan
                await deletePlanByName(name_1, auth.testWrite);

                // Create remediation plan with 4 issues x 3-6 systems
                const r1 = await request
                .post('/v1/remediations')
                .set(auth.testWrite)
                .send({
                    name: name_1,
                    add: {
                        issues: [
                            {
                                id: 'advisor:bond_config_issue|NO_QUOTES',
                                systems: [
                                    '56db4b54-6273-48dc-b0be-41eb4dc87c7f',
                                    'f5ce853a-c922-46f7-bd82-50286b7d8459',
                                    '2e9c9324-d42f-461f-b35f-706e667e713a',
                                    '7f3d9680-c7dc-4c63-911b-c7037c19214c',
                                    'b72c7d02-7a97-4189-9a63-2c45232b8f7a',
                                    '82d28ead-411f-4561-b934-906f1eebba1b'
                                ]
                            },
                            {
                                id: 'advisor:bond_config_issue|EXTRA_WHITESPACE',
                                systems: [
                                    'f5ce853a-c922-46f7-bd82-50286b7d8459',
                                    '2e9c9324-d42f-461f-b35f-706e667e713a',
                                    '7f3d9680-c7dc-4c63-911b-c7037c19214c',
                                    'b72c7d02-7a97-4189-9a63-2c45232b8f7a',
                                    '82d28ead-411f-4561-b934-906f1eebba1b'
                                ]
                            },
                            {
                                id: 'advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074',
                                resolution: 'selinux_mitigate',
                                systems: [
                                    '2e9c9324-d42f-461f-b35f-706e667e713a',
                                    '7f3d9680-c7dc-4c63-911b-c7037c19214c',
                                    'b72c7d02-7a97-4189-9a63-2c45232b8f7a',
                                    '82d28ead-411f-4561-b934-906f1eebba1b'
                                ]
                            },
                            {
                                id: 'advisor:network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE',
                                systems: [
                                    '7f3d9680-c7dc-4c63-911b-c7037c19214c',
                                    'b72c7d02-7a97-4189-9a63-2c45232b8f7a',
                                    '82d28ead-411f-4561-b934-906f1eebba1b'
                                ]
                            }
                        ]
                    }
                })
                .expect(201);

                const plan_id = r1.body.id;

                // bulk delete 3 systems
                const r2 = await request
                .delete(`/v1/remediations/${plan_id}/systems`)
                .set(auth.testWrite)
                .send({
                    system_ids: [
                        '56db4b54-6273-48dc-b0be-41eb4dc87c7f',
                        'f5ce853a-c922-46f7-bd82-50286b7d8459',
                        '2e9c9324-d42f-461f-b35f-706e667e713a'
                    ]
                })
                .expect(200);

                r2.body.should.have.size(1);
                r2.body.should.have.property('deleted_count');
                r2.body.deleted_count.should.equal(6);

                const r3 = await request.get(`/v1/remediations/${plan_id}`).set(auth.testWrite);

                // different every time
                r3.body.id = '';
                r3.body.created_at = '';
                r3.body.updated_at = '';

                expect(r3.body).toMatchSnapshot();
            });

            test('does not remove systems from other plans', async () => {
                // remove any existing plans
                await deletePlanByName(name_1, auth.testWrite);
                await deletePlanByName(name_2, auth.testWrite);

                // Create 2 plans with 4 issues x 6 systems
                const plan_id_1 = await createPlan(name_1, issues, systems, auth.testWrite);
                const plan_id_2 = await createPlan(name_2, issues, systems, auth.testWrite);

                // bulk delete 3 systems from plan 1
                const r1 = await request
                    .delete(`/v1/remediations/${plan_id_1}/systems`)
                    .set(auth.testWrite)
                    .send({
                        system_ids: [
                            '56db4b54-6273-48dc-b0be-41eb4dc87c7f',
                            'f5ce853a-c922-46f7-bd82-50286b7d8459',
                            '2e9c9324-d42f-461f-b35f-706e667e713a'
                        ]
                    })
                    .expect(200);

                r1.body.should.have.size(1);
                r1.body.should.have.property('deleted_count');
                r1.body.deleted_count.should.equal(12);

                // verify plan_1 is correct...
                const r2 = await request.get(`/v1/remediations/${plan_id_1}`).set(auth.testWrite);

                // different every time
                r2.body.id = '';
                r2.body.created_at = '';
                r2.body.updated_at = '';

                expect(r2.body).toMatchSnapshot();

                // verify plan_2 is correct...
                const r3 = await request.get(`/v1/remediations/${plan_id_1}`).set(auth.testWrite);

                // different every time
                r3.body.id = '';
                r3.body.created_at = '';
                r3.body.updated_at = '';

                expect(r3.body).toMatchSnapshot();
            });

            test('returns 404 for wrong owner', async () => {
                // remove any existing plan
                await deletePlanByName(name_1, auth.testWrite);

                // Create plan with 4 issues x 6 systems
                const plan_id = await createPlan(name_1, issues, systems, auth.testWrite);

                // bulk delete 3 systems from plan as wrong user
                await request
                .delete(`/v1/remediations/${plan_id}/systems`)
                .set(auth.testWrite2)
                .send({
                    system_ids: [
                        '56db4b54-6273-48dc-b0be-41eb4dc87c7f',
                        'f5ce853a-c922-46f7-bd82-50286b7d8459',
                        '2e9c9324-d42f-461f-b35f-706e667e713a'
                    ]
                })
                .expect(404);
            });

            test('succeeds for exactly 100 systems', async () => {
                // remove any existing plan
                await deletePlanByName(name_1, auth.testWrite);

                // Create plan with 4 issues x 6 systems
                const plan_id = await createPlan(name_1, issues, systems, auth.testWrite);

                // bulk delete 100 systems from plan
                await request
                .delete(`/v1/remediations/${plan_id}/systems`)
                .set(auth.testWrite)
                .send({
                    system_ids: Array(100).fill('56db4b54-6273-48dc-b0be-41eb4dc87c7f')
                })
                .expect(200);
            });

            test('returns 400 for 101 systems', async () => {
                // remove any existing plan
                await deletePlanByName(name_1, auth.testWrite);

                // Create plan with 4 issues x 6 systems
                const plan_id = await createPlan(name_1, issues, systems, auth.testWrite);

                // bulk delete 101 systems from plan
                await request
                .delete(`/v1/remediations/${plan_id}/systems`)
                .set(auth.testWrite)
                .send({
                    system_ids: Array(101).fill('56db4b54-6273-48dc-b0be-41eb4dc87c7f')
                })
                .expect(400);
            });

            test('returns 400 for 0 systems', async () => {
                // remove any existing plan
                await deletePlanByName(name_1, auth.testWrite);

                // Create plan with 4 issues x 6 systems
                const plan_id = await createPlan(name_1, issues, systems, auth.testWrite);

                // bulk delete 0 systems from plan
                await request
                .delete(`/v1/remediations/${plan_id}/systems`)
                .set(auth.testWrite)
                .send({
                    system_ids: []
                })
                .expect(400);
            });

            test('returns 400 for malformed system id', async () => {
                // remove any existing plan
                await deletePlanByName(name_1, auth.testWrite);

                // Create plan with 4 issues x 6 systems
                const plan_id = await createPlan(name_1, issues, systems, auth.testWrite);

                // bulk delete with malformed system
                await request
                .delete(`/v1/remediations/${plan_id}/systems`)
                .set(auth.testWrite)
                .send({
                    system_ids: [
                        '56db4b54-6273-48dc-b0be-41eb4dc87c7f',
                        'f5ce853a-c922-46f7-bd82-50286b7d8459',
                        'bob is the brother of your mother',
                        '2e9c9324-d42f-461f-b35f-706e667e713a'
                    ]
                })
                .expect(400);
            });

            test('returns 400 for malformed plan id', async () => {
                // remove any existing plan
                await deletePlanByName(name_1, auth.testWrite);

                // Create plan with 4 issues x 6 systems
                const plan_id = await createPlan(name_1, issues, systems, auth.testWrite);

                // bulk delete with malformed system
                await request
                .delete(`/v1/remediations/robert/systems`)
                .set(auth.testWrite)
                .send({
                    system_ids: [
                        '56db4b54-6273-48dc-b0be-41eb4dc87c7f',
                        'f5ce853a-c922-46f7-bd82-50286b7d8459',
                        '2e9c9324-d42f-461f-b35f-706e667e713a'
                    ]
                })
                .expect(400);
            });
        });

        describe('single system', () => {
            test('removes a system from all issues in a plan', async () => {
                const planName = 'delete single system across issues test';
                await deletePlanByName(planName, auth.testWrite);
                const plan_id = await createPlan(planName, issues, systems, auth.testWrite);

                const systemToRemove = systems[0];

                // Verify system exists across issues before deletion
                let { body: planBefore } = await request
                    .get(`/v1/remediations/${plan_id}`)
                    .set(auth.testWrite)
                    .expect(200);

                planBefore.issues.forEach(issue => {
                    const ids = issue.systems.map(s => s.id);
                    ids.should.containEql(systemToRemove);
                });

                // Delete the system from all issues
                await request
                    .delete(`/v1/remediations/${plan_id}/systems/${systemToRemove}`)
                    .set(auth.testWrite)
                    .expect(204);

                // Verify the system is gone from all issues
                const { body: planAfter } = await request
                    .get(`/v1/remediations/${plan_id}`)
                    .set(auth.testWrite)
                    .expect(200);

                planAfter.issues.forEach(issue => {
                    const ids = issue.systems.map(s => s.id);
                    ids.should.not.containEql(systemToRemove);
                });
            });

            test('returns 404 when deleting the same system twice', async () => {
                const planName = 'delete single system returns 404 on second attempt';

                await deletePlanByName(planName, auth.testWrite);
                const plan_id = await createPlan(planName, issues, systems, auth.testWrite);
                const systemToRemove = systems[1];

                await request
                    .delete(`/v1/remediations/${plan_id}/systems/${systemToRemove}`)
                    .set(auth.testWrite)
                    .expect(204);

                await request
                    .delete(`/v1/remediations/${plan_id}/systems/${systemToRemove}`)
                    .set(auth.testWrite)
                    .expect(404);
            });

            test('returns 404 for wrong owner', async () => {
                const planName = 'delete single system wrong owner';

                await deletePlanByName(planName, auth.testWrite);
                const plan_id = await createPlan(planName, issues, systems, auth.testWrite);

                await request
                    .delete(`/v1/remediations/${plan_id}/systems/${systems[2]}`)
                    .set(auth.testWrite2)
                    .expect(404);
            });

            test('returns 400 for malformed system id', async () => {
                const planName = 'delete single system malformed system id';

                await deletePlanByName(planName, auth.testWrite);
                const plan_id = await createPlan(planName, issues, systems, auth.testWrite);

                await request
                    .delete(`/v1/remediations/${plan_id}/systems/not-a-uuid`)
                    .set(auth.testWrite)
                    .expect(400);
            });

            test('returns 400 for malformed plan id', async () => {
                await request
                    .delete('/v1/remediations/not-a-uuid/systems/56db4b54-6273-48dc-b0be-41eb4dc87c7f')
                    .set(auth.testWrite)
                    .expect(400);
            });
        });
    });

    describe('remediations write RBAC', function () {
        test('permission = remediations:*:read does not allow POST /v1/remediations to run', async () => {
            getSandbox().stub(rbac, 'getRemediationsAccess').resolves(buildRbacResponse('remediations:*:read'));

            const name = 'remediation';

            const {body} = await request
            .post('/v1/remediations')
            .set(auth.testWrite)
            .send({name})
            .expect(403);

            body.errors[0].details.message.should.equal(
                'Permission remediations:remediation:write is required for this operation'
            );
        });

        test('permission = remediations:resolution:* does not allow POST /v1/remediations to run', async () => {
            getSandbox().stub(rbac, 'getRemediationsAccess').resolves(buildRbacResponse('remediations:resolution:*'));

            const name = 'remediation';

            const {body} = await request
            .post('/v1/remediations')
            .set(auth.testWrite)
            .send({name})
            .expect(403);

            body.errors[0].details.message.should.equal(
                'Permission remediations:remediation:write is required for this operation'
            );
        });

        test('permission = [] does not allow POST /v1/remediations to be read', async () => {
            getSandbox().stub(rbac, 'getRemediationsAccess').resolves([]);

            const name = 'remediation';

            const {body} = await request
            .post('/v1/remediations')
            .set(auth.testWrite)
            .send({name})
            .expect(403);

            body.errors[0].details.message.should.equal(
                'Permission remediations:remediation:write is required for this operation'
            );
        });
    });

    describe('systems caching', function () {
        test('stores system details in systems table when creating remediation', async () => {
            const systemId = '56db4b54-6273-48dc-b0be-41eb4dc87c7f';
            
            // Ensure system doesn't exist before test
            await db.systems.destroy({
                where: { id: systemId },
                force: true
            });

            const {body} = await request
                .post('/v1/remediations')
                .set(auth.testWrite)
                .send({
                    name: 'test system caching on create',
                    add: {
                        issues: [{id: 'advisor:bond_config_issue|NO_QUOTES'}],
                        systems: [systemId]
                    }
                })
                .expect(201);

            body.should.have.property('id');

            // Verify system was cached
            const cachedSystem = await db.systems.findByPk(systemId);
            cachedSystem.should.not.be.null();
            cachedSystem.should.have.property('id', systemId);
            // These fields should exist (can be null if HBI doesn't provide them)
            cachedSystem.should.have.property('hostname');
            cachedSystem.should.have.property('display_name');
            cachedSystem.should.have.property('ansible_hostname');
        });

        test('stores system details in systems table when updating remediation', async () => {
            const existingSystemId = '56db4b54-6273-48dc-b0be-41eb4dc87c7f';
            const newSystemId = 'f5ce853a-c922-46f7-bd82-50286b7d8459';
            
            // Create initial remediation with one system
            const {body: createBody} = await request
                .post('/v1/remediations')
                .set(auth.testWrite)
                .send({
                    name: 'test system caching on patch',
                    add: {
                        issues: [{id: 'advisor:bond_config_issue|NO_QUOTES'}],
                        systems: [existingSystemId]
                    }
                })
                .expect(201);

            const remediationId = createBody.id;

            // Ensure new system doesn't exist before patch
            await db.systems.destroy({
                where: { id: newSystemId },
                force: true
            });

            // Add new system via patch
            await request
                .patch(`/v1/remediations/${remediationId}`)
                .set(auth.testWrite)
                .send({
                    add: {
                        issues: [{id: 'advisor:bond_config_issue|EXTRA_WHITESPACE'}],
                        systems: [newSystemId]
                    }
                })
                .expect(200);

            // Verify both systems are cached
            const existingCachedSystem = await db.systems.findByPk(existingSystemId);
            const newCachedSystem = await db.systems.findByPk(newSystemId);
            
            existingCachedSystem.should.not.be.null();
            newCachedSystem.should.not.be.null();
            
            newCachedSystem.should.have.property('id', newSystemId);
            newCachedSystem.should.have.property('hostname');
            newCachedSystem.should.have.property('display_name');
            newCachedSystem.should.have.property('ansible_hostname');
        });

        test('handles duplicate systems gracefully with ignoreDuplicates', async () => {
            const systemId = '56db4b54-6273-48dc-b0be-41eb4dc87c7f';
            
            // Create first remediation with system
            await request
                .post('/v1/remediations')
                .set(auth.testWrite)
                .send({
                    name: 'first remediation',
                    add: {
                        issues: [{id: 'advisor:bond_config_issue|NO_QUOTES'}],
                        systems: [systemId]
                    }
                })
                .expect(201);

            // Create second remediation with same system (should not fail)
            await request
                .post('/v1/remediations')
                .set(auth.testWrite)
                .send({
                    name: 'second remediation',
                    add: {
                        issues: [{id: 'advisor:bond_config_issue|EXTRA_WHITESPACE'}],
                        systems: [systemId]
                    }
                })
                .expect(201);

            // Verify system exists only once
            const cachedSystems = await db.systems.findAll({
                where: { id: systemId }
            });
            cachedSystems.should.have.length(1);
        });
    });
});
