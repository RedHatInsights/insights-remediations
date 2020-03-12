/*eslint-disable max-len*/
'use strict';

const { request, auth, mockDate, mockPlaybookRunId, buildRbacResponse } = require('../test');
const utils = require('../middleware/identity/utils');
const receptor = require('../connectors/receptor');
const fifi = require('../remediations/fifi');
const base = require('../test');
const errors = require('../errors');
const rbac = require('../connectors/rbac');

describe('FiFi', function () {
    describe('connection status', function () {
        test('obtains connection status', async () => {
            const {text} = await request
            .get('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/connection_status?pretty')
            .set(auth.fifi)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('404s on empty playbook', async () => {
            const {body} = await request
            .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f6927/connection_status?pretty')
            .set(auth.fifi)
            .expect(200);

            body.meta.count.should.eql(0);
            body.meta.total.should.eql(0);
            body.data.should.eql([]);
        });

        test('400 get connection status', async () => {
            await request
            .set(auth.fifi)
            .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d150000/connection_status')
            .expect(400);
        });

        test('get connection status with false smartManagement', async () => {
            await request
            .get('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/connection_status')
            .set(utils.IDENTITY_HEADER, utils.createIdentityHeader('fifi', 'fifi', true, data => {
                data.entitlements.smart_management = false;
                return data;
            }))
            .expect(403);
        });

        test('sets ETag', async () => {
            const {headers} = await request
            .get('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/connection_status?pretty')
            .set(auth.fifi)
            .expect(200);

            headers.etag.should.equal('"1062-Pl88DazTBuJo//SQVNUn6pZAllk"');
        });

        test('304s on ETag match', async () => {
            await request
            .get('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/connection_status?pretty')
            .set(auth.fifi)
            .set('if-none-match', '"1062-Pl88DazTBuJo//SQVNUn6pZAllk"')
            .expect(304);
        });
    });

    describe('playbook run', function () {
        describe('GET', function () {
            test('playbook_runs', async () => {
                const {body, text} = await request
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs')
                .set(auth.fifi)
                .expect(200);

                body.meta.count.should.equal(1);
                body.data[0].should.have.property('id', '88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc');
                body.data[0].should.have.property('status', 'running');
                body.data[0].should.have.property('created_at', '2019-12-23T08:19:36.641Z');

                body.data[0].executors[0].should.have.property('executor_id', '21a0ba73-1035-4e7d-b6d6-4b530cbfb5bd');
                body.data[0].executors[0].should.have.property('executor_name', 'executor-2');
                body.data[0].executors[0].should.have.property('system_count', 1);

                body.data[0].executors[1].should.have.property('executor_id', '77c0ba73-1015-4e7d-a6d6-4b530cbfb5bd');
                body.data[0].executors[1].should.have.property('executor_name', 'executor-1');
                body.data[0].executors[1].should.have.property('system_count', 2);
                expect(text).toMatchSnapshot();
            });

            test('playbook_runs/:playbook_run_id', async () => {
                const {body, text} = await request
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc')
                .set(auth.fifi)
                .expect(200);

                body.should.have.property('id', '88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc');
                body.should.have.property('status', 'running');
                body.should.have.property('created_at', '2019-12-23T08:19:36.641Z');

                body.executors[0].should.have.property('executor_id', '21a0ba73-1035-4e7d-b6d6-4b530cbfb5bd');
                body.executors[0].should.have.property('executor_name', 'executor-2');
                body.executors[0].should.have.property('status', 'running');
                body.executors[0].should.have.property('system_count', 1);

                body.executors[1].should.have.property('executor_id', '77c0ba73-1015-4e7d-a6d6-4b530cbfb5bd');
                body.executors[1].should.have.property('executor_name', 'executor-1');
                body.executors[1].should.have.property('status', 'running');
                body.executors[1].should.have.property('system_count', 2);
                expect(text).toMatchSnapshot();
            });

            test('playbook_runs/:playbook_run_id/systems', async () => {
                const {body, text} = await request
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/systems')
                .set(auth.fifi)
                .expect(200);

                body.meta.count.should.equal(3);
                body.meta.total.should.equal(3);
                body.data.should.have.length(3);
                body.data[0].should.have.property('system_id', 'a68f36f4-b9b1-4eae-b0ad-dc528bf6b16f');
                body.data[0].should.have.property('system_name', 'system-3');
                body.data[0].should.have.property('playbook_run_executor_id', '55c0ba73-0215-4e7d-a6d6-4b530cbfb5bd');

                body.data[1].should.have.property('system_id', '3590ba1a-e0df-4092-9c23-bca863b28573');
                body.data[1].should.have.property('system_name', 'system-2');
                body.data[1].should.have.property('playbook_run_executor_id', '66d0ba73-0015-4e7d-a6d6-4b530cbfb5bd');

                body.data[2].should.have.property('system_id', '7b136dd2-4824-43cf-af6c-ad0ee42f9f97');
                body.data[2].should.have.property('system_name', 'system-1');
                body.data[2].should.have.property('playbook_run_executor_id', '66d0ba73-0015-4e7d-a6d6-4b530cbfb5bd');
                expect(text).toMatchSnapshot();
            });

            test('playbook_runs/:playbook_run_id/systems/:system', async () => {
                const {body, text} = await request
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/systems/7b136dd2-4824-43cf-af6c-ad0ee42f9f97')
                .set(auth.fifi)
                .expect(200);

                body.should.have.property('system_id', '7b136dd2-4824-43cf-af6c-ad0ee42f9f97');
                body.should.have.property('system_name', 'system-1');
                body.should.have.property('status', 'running');
                body.should.have.property('console', 'These are the logs for console-5');
                body.should.have.property('updated_at', '2019-12-23T18:19:36.641Z');
                body.should.have.property('playbook_run_executor_id', '66d0ba73-0015-4e7d-a6d6-4b530cbfb5bd');
                expect(text).toMatchSnapshot();
            });

            test('400 on bad remediationID playbook_runs', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-81f8111/playbook_runs')
                .expect(400);
            });

            test('400 on bad remediationID playbook_runs/:playbook_run_id', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142cf-b2ec-c8c5881f8111/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc')
                .expect(400);
            });

            test('400 on bad playbookRunId playbook_runs/:playbook_run_id', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba7e7d-a6d6-4b530cbfbabc')
                .expect(400);
            });

            test('400 on unknown remediationID playbook_runs/:playbook_run_id/systems', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c=c3f-b2ec-c8c5881f8111/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/systems')
                .expect(400);
            });

            test('400 on bad playbook_run_id playbook_runs/:playbook_run_id/systems', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a4b530cbfb111/systems')
                .expect(400);
            });

            test('400 on bad remediationID playbook_runs/:playbook_run_id/systems/:system', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2aeec-c8c5881f8111/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/systems/7b136dd2-4824-43cf-af6c-ad0ee42f9f97')
                .expect(400);
            });

            test('400 on bad playbookRunId playbook_runs/:playbook_run_id/systems/:system', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e6-4b530cbfb111/systems/7b136dd2-4824-43cf-af6c-ad0ee42f9f97')
                .expect(400);
            });

            test('400 on bad systemId playbook_runs/:playbook_run_id/systems/:system', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb111/systems/a8c4bbeb-dbcf-4fdb-94bc-19e')
                .expect(400);
            });

            test('404 on unknown remediationID playbook_runs', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8111/playbook_runs')
                .expect(404);
            });

            test('404 on unknown remediationID playbook_runs/:playbook_run_id', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8111/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc')
                .expect(404);
            });

            test('404 on unknown playbookRunId playbook_runs/:playbook_run_id', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfbabc')
                .expect(404);
            });

            test('404 on unknown remediationID playbook_runs/:playbook_run_id/systems', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8111/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/systems')
                .expect(404);
            });

            test('404 on unknown playbook_run_id playbook_runs/:playbook_run_id/systems', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb111/systems')
                .expect(404);
            });

            test('404 on unknown remediationID playbook_runs/:playbook_run_id/systems/:system', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8111/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/systems/a8c4bbeb-dbcf-4fdb-94bc-19e45e961cb1')
                .expect(404);
            });

            test('404 on unknown playbookRunId playbook_runs/:playbook_run_id/systems/:system', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb111/systems/a8c4bbeb-dbcf-4fdb-94bc-19e45e961cb1')
                .expect(404);
            });

            test('404 on unknown systemId playbook_runs/:playbook_run_id/systems/:system', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb111/systems/a8c4bbeb-dbcf-4fdb-94bc-19e45e961123')
                .expect(404);
            });

            test('run playbook_run with false smartManagement', async () => {
                await request
                .get('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs')
                .set(utils.IDENTITY_HEADER, utils.createIdentityHeader('fifi', 'fifi', true, data => {
                    data.entitlements.smart_management = false;
                    return data;
                }))
                .expect(403);
            });

            test('run playbook_run/:playbook_run_id with false smartManagement', async () => {
                await request
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc')
                .set(utils.IDENTITY_HEADER, utils.createIdentityHeader('fifi', 'fifi', true, data => {
                    data.entitlements.smart_management = false;
                    return data;
                }))
                .expect(403);
            });

            test('run playbook_run/:playbook_run_id/systems with false smartManagement', async () => {
                await request
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/systems')
                .set(utils.IDENTITY_HEADER, utils.createIdentityHeader('fifi', 'fifi', true, data => {
                    data.entitlements.smart_management = false;
                    return data;
                }))
                .expect(403);
            });

            test('run playbook_run/:playbook_run_id/systems/:system with false smartManagement', async () => {
                await request
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/systems/7b136dd2-4824-43cf-af6c-ad0ee42f9f97')
                .set(utils.IDENTITY_HEADER, utils.createIdentityHeader('fifi', 'fifi', true, data => {
                    data.entitlements.smart_management = false;
                    return data;
                }))
                .expect(403);
            });

            test('sets etag for playbook_run/:playbook_run_id/systems/:system', async () => {
                const {headers} = await request
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/systems/7b136dd2-4824-43cf-af6c-ad0ee42f9f97')
                .set(auth.fifi)
                .expect(200);

                headers.etag.should.equal('"f7-TX5//7bMmGeeb9pdaNTPbjQ6pck"');
            });

            test('304 on etag match for playbook_run/:playbook_run_id/systems/:system', async () => {
                await request
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/systems/7b136dd2-4824-43cf-af6c-ad0ee42f9f97')
                .set('if-none-match', '"f7-TX5//7bMmGeeb9pdaNTPbjQ6pck"')
                .expect(304);
            });
        });

        describe('POST', function () {
            test('post playbook run', async () => {
                await request
                .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs')
                .set(auth.fifi)
                .set('if-match', '"1062-Pl88DazTBuJo//SQVNUn6pZAllk"')
                .expect(201);
            });

            test('400 post playbook run', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d150000/connection_status')
                .expect(400);
            });

            test('execute playbook run with false smartManagement', async () => {
                await request
                .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs')
                .set(utils.IDENTITY_HEADER, utils.createIdentityHeader('fifi', 'fifi', true, data => {
                    data.entitlements.smart_management = false;
                    return data;
                }))
                .expect(403);
            });

            test('sets ETag', async () => {
                const {headers} = await request
                .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs?pretty')
                .set(auth.fifi)
                .set('if-match', '"1062-Pl88DazTBuJo//SQVNUn6pZAllk"')
                .expect(201);

                headers.etag.should.equal('"1062-Pl88DazTBuJo//SQVNUn6pZAllk"');
            });

            test('201s on ETag match', async () => {
                await request
                .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs')
                .set(auth.fifi)
                .set('if-match', '"1062-Pl88DazTBuJo//SQVNUn6pZAllk"')
                .expect(201);
            });

            test('returns 412 if ETags not match', async () => {
                const {headers} = await request
                .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs')
                .set(auth.fifi)
                .set('if-match', '"1062-Pl88DazTBuJo//SQVNUn6pZAlmk"')
                .expect(412);

                headers.etag.should.equal('"1062-Pl88DazTBuJo//SQVNUn6pZAllk"');
            });

            test('if if-match is not present, proceed', async () => {
                await request
                .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs')
                .set(auth.fifi)
                .expect(201);
            });

            test('check object being send to receptor connector', async function () {
                mockDate();
                mockPlaybookRunId();

                const spy = base.getSandbox().spy(receptor, 'postInitialRequest');

                await request
                .post('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs')
                .set(auth.fifi)
                .expect(201);

                spy.callCount.should.equal(2);
                expect(spy.args[0]).toMatchSnapshot();
                expect(spy.args[1]).toMatchSnapshot();
            });

            test('if no executors are send to postInitialRequest', async function () {
                base.getSandbox().stub(fifi, 'sendInitialRequest').resolves(null);

                const {body} = await request
                .post('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs')
                .set(auth.fifi)
                .expect(400);

                body.errors[0].should.have.property('code', 'NO_EXECUTORS');
                body.errors[0].should.have.property('title',
                    'No executors available for Playbook "FiFI playbook 3" (249f142c-2ae3-4c3f-b2ec-c8c5881f8561)');
            });

            test('if 1st executor result from receptor connector is request error', async function () {
                base.getSandbox().stub(receptor, 'postInitialRequest')
                .rejects(errors.internal.dependencyError(new Error('receptor down'), receptor));

                const {body} = await request
                .post('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs')
                .set(auth.fifi)
                .expect(503);

                body.errors[0].should.have.property('code', 'DEPENDENCY_UNAVAILABLE');
                body.errors[0].details.should.have.property('name', 'receptor');
                body.errors[0].details.should.have.property('impl', 'mock');
            });

            test('if 2nd executor result from receptor is request error', async function () {
                const stub = base.getSandbox().stub(receptor, 'postInitialRequest');
                stub.onCall(2)
                .rejects(errors.internal.dependencyError(new Error('receptor down'), receptor));
                stub.callThrough();

                const {body} =  await request
                .post('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs')
                .set(auth.fifi)
                .expect(201);

                body.should.have.property('id');
            });
        });
    });

    describe('fifi RBAC', function () {
        test('if user has correct RBAC permissions', async function () {
            base.getSandbox().stub(rbac, 'getRemediationsAccess').resolves(buildRbacResponse('remediations:*:*'));

            await request
            .post('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs')
            .set(auth.fifi)
            .expect(201);
        });

        test('if user does not have correct RBAC permissions', async function () {
            base.getSandbox().stub(rbac, 'getRemediationsAccess').resolves(buildRbacResponse('remediations:remediation:write'));

            const {body} = await request
            .post('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs')
            .set(auth.fifi)
            .expect(403);

            body.errors[0].details.message.should.equal(
                'Permission remediations:remediation:execute is required for this operation'
            );
        });

        test('if RBAC connector returns no permissions at all', async function () {
            base.getSandbox().stub(rbac, 'getRemediationsAccess').resolves([]);

            const {body} = await request
            .post('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs')
            .set(auth.fifi)
            .expect(403);

            body.errors[0].details.message.should.equal(
                'Permission remediations:remediation:execute is required for this operation'
            );
        });
    });
});
