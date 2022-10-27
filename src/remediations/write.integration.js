'use strict';

const _ = require('lodash');
const config = require('../config');
const rbac = require('../connectors/rbac');
const { request, reqId, auth, getSandbox, buildRbacResponse } = require('../test');
const { NON_EXISTENT_SYSTEM } = require('../connectors/inventory/mock');
const uuid = require('uuid');

function testIssue (remediation, id, resolution, systems) {
    const issue = _.find(remediation.issues, {id});
    issue.resolution.id.should.equal(resolution);
    issue.systems.should.have.length(systems.length);
    issue.systems.map(system => system.id).should.containDeep(systems);
}

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
                code: 'pattern.openapi.validation',
                title: 'should match pattern "^$|^.*[\\w\\d]+.*$" (location: body, path: name)'
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
            const name = 'new remediation with issues';
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
                code: 'additionalProperties.openapi.validation',
                title: 'should NOT have additional properties (location: body, path: undefined)'
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
                        code: 'required.openapi.validation',
                        title: 'should have required property \'id\' (location: body, path: add.issues[0].id)'
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
                        code: 'minItems.openapi.validation',
                        title: 'should NOT have fewer than 1 items (location: body, path: add.issues)'
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

    describe('remove', function () {
        test('remediation', async () => {
            await request
            .delete('/v1/remediations/3d34ed5c-a71f-48ee-b7af-b215f27ae68d')
            .set(auth.testWrite)
            .expect(204);

            await request
            .delete('/v1/remediations/3d34ed5c-a71f-48ee-b7af-b215f27ae68d')
            .set(auth.testWrite)
            .expect(404);
        });

        describe('bulk delete', () => {
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

                body.deleted_count.should.equal(3)
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
                .send({remediation_ids: Array.from({length: id_count}, () => {return 'c11b0d3e-6b0d-4dd6-a531-12121afd3ec0'})})
                .set(auth.testBulk)
                .expect(400);

                res.body.errors[0].id = ''; // id is different every time..
                expect(res.body).toMatchSnapshot()
            });

            test('missing body', async () => {
                const res = await request
                .delete('/v1/remediations')
                .set('Content-Type', 'application/json')
                .set(auth.testBulk)
                .expect(400);

                res.body.errors[0].id = ''; // id is different every time..
                expect(res.body).toMatchSnapshot()
            });

            test('empty list', async () => {
                const res = await request
                .delete('/v1/remediations')
                .send({remediation_ids: []})
                .set(auth.testBulk)
                .expect(400);

                res.body.errors[0].id = ''; // id is different every time..
                expect(res.body).toMatchSnapshot()
            });

            test('repeated ids', async () => {
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
});
