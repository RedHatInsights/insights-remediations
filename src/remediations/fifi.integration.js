/*eslint-disable max-len*/
'use strict';

const { request, auth, mockDate, mockUuid, buildRbacResponse } = require('../test');
const utils = require('../middleware/identity/utils');
const configManager = require('../connectors/configManager');
const receptor = require('../connectors/receptor');
const fifi = require('../remediations/fifi');
const base = require('../test');
const errors = require('../errors');
const rbac = require('../connectors/rbac');
const queries = require('./remediations.queries');
const dispatcher = require('../connectors/dispatcher');
const config = require('../config');
const db = require('../db');

describe('FiFi', function () {
    describe('executable', function () {
        test('remediation is executable', async () => {
            await request
            .get('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/executable')
            .set(auth.fifi)
            .expect(200);
        });

        test('remediation is executable with smartManagement false but RHC on', async () => {
            base.getSandbox().stub(config, 'isMarketplace').value(true);
            await request
            .get('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/executable')
            .set(utils.IDENTITY_HEADER, utils.createIdentityHeader('fifi', 'fifi', true, data => {
                data.entitlements.smart_management = false;
                return data;
            }))
            .expect(200);
        });

        test('remediation is not executable with smartManagment false but isMarketplace false', async () => {
            await request
            .get('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/executable')
            .set(utils.IDENTITY_HEADER, utils.createIdentityHeader('fifi', 'fifi', true, data => {
                data.entitlements.smart_management = false;
                return data;
            }))
            .expect(403);
        });

        test('400 on incorrect remediationID', async () => {
            await request
            .get('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5c/executable')
            .set(auth.fifi)
            .expect(400);
        });

        test('404 on unknown remediationID', async () => {
            await request
            .get('/v1/remediations/6ecb5db7-2f1a-441b-8220-e5ce45066f60/executable')
            .set(auth.fifi)
            .expect(404);
        });
    });

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

        test('404 on empty query', async () => {
            await request
            .get('/v1/remediations/b0dd77e5-b7aa-4752-aa66-f79f7a7705b8/connection_status?pretty')
            .set(auth.fifi)
            .expect(404);
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

        test('get connection status with false smartManagement but with system connected to RHC', async () => {
            base.getSandbox().stub(config, 'isMarketplace').value(true);
            const {text} = await request
            .get('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/connection_status?pretty')
            .set(utils.IDENTITY_HEADER, utils.createIdentityHeader('fifi', 'fifi', true, data => {
                data.entitlements.smart_management = false;
                return data;
            }))
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('get connection status with false smartManagment but not configured with config manager', async () => {
            base.getSandbox().stub(config, 'isMarketplace').value(true);
            base.getSandbox().stub(configManager, 'getCurrentState').resolves({
                account: '654321',
                state: {
                    remediations: 'disabled'
                },
                id: 'c5639a03-4640-4ae3-93ce-9966cae18df7',
                label: 'b7839a03-4640-4ae3-93ce-9966cae18df8'
            });
            const {text} = await request
            .get('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/connection_status?pretty')
            .set(utils.IDENTITY_HEADER, utils.createIdentityHeader('fifi', 'fifi', true, data => {
                data.entitlements.smart_management = false;
                return data;
            }))
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('get connection status with smartManagment but not enabled with config manager', async () => {
            base.getSandbox().stub(config, 'isMarketplace').value(true);
            base.getSandbox().stub(configManager, 'getCurrentState').resolves({
                account: '654321',
                state: {
                    remediations: 'disabled'
                },
                id: 'c5639a03-4640-4ae3-93ce-9966cae18df7',
                label: 'b7839a03-4640-4ae3-93ce-9966cae18df8'
            });
            const {text} = await request
            .get('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/connection_status?pretty')
            .set(auth.fifi)
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test('sets ETag', async () => {
            const {headers} = await request
            .get('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/connection_status?pretty')
            .set(auth.fifi)
            .expect(200);

            headers.etag.should.equal('"126e-MHacGzIMEd1TEWbdQQBBLW62CF0"');
        });

        test('304s on ETag match', async () => {
            await request
            .get('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/connection_status?pretty')
            .set(auth.fifi)
            .set('if-none-match', '"126e-MHacGzIMEd1TEWbdQQBBLW62CF0"')
            .expect(304);
        });
    });

    describe('playbook run', function () {
        describe('GET', function () {
            test('playbook_runs', async () => {
                mockUuid();
                const {body, text} = await request
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs')
                .set(auth.fifi)
                .expect(200);

                body.meta.count.should.equal(2);
                body.meta.total.should.equal(2);
                body.data[0].should.have.property('id', '31a70e85-378a-4436-96e9-677cd6fba660');
                body.data[0].should.have.property('status', 'pending');
                body.data[0].should.have.property('created_at', '2020-02-23T06:19:36.641Z');

                body.data[1].should.have.property('id', '88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc');
                body.data[1].should.have.property('status', 'running');
                body.data[1].should.have.property('created_at', '2019-12-23T08:19:36.641Z');

                body.data[0].executors[0].should.have.property('executor_id', '3ee8f640-ec08-46eb-be77-b80785c476d9');
                body.data[0].executors[0].should.have.property('executor_name', 'executor-25');
                body.data[0].executors[0].should.have.property('status', 'pending');
                body.data[0].executors[0].should.have.property('system_count', 1);
                body.data[0].executors[0].counts.should.have.property('pending', 1);

                body.data[0].executors[1].should.have.property('executor_id', '31a70e85-378a-4436-96e9-677cd6fba660');
                body.data[0].executors[1].should.have.property('executor_name', 'Direct connected');
                body.data[0].executors[1].should.have.property('status', 'running');
                body.data[0].executors[1].should.have.property('system_count', 1);
                body.data[0].executors[1].counts.should.have.property('pending', 0);

                body.data[1].executors[0].should.have.property('executor_id', '21a0ba73-1035-4e7d-b6d6-4b530cbfb5bd');
                body.data[1].executors[0].should.have.property('executor_name', 'executor-2');
                body.data[1].executors[0].should.have.property('status', 'running');
                body.data[1].executors[0].should.have.property('system_count', 5);
                body.data[1].executors[0].counts.should.have.property('failure', 3);
                body.data[1].executors[0].counts.should.have.property('canceled', 2);

                body.data[1].executors[1].should.have.property('executor_id', '77c0ba73-1015-4e7d-a6d6-4b530cbfb5bd');
                body.data[1].executors[1].should.have.property('executor_name', 'executor-1');
                body.data[1].executors[1].should.have.property('status', 'running');
                body.data[1].executors[1].should.have.property('system_count', 6);
                body.data[1].executors[1].counts.should.have.property('running', 1);
                body.data[1].executors[1].counts.should.have.property('success', 3);
                body.data[1].executors[1].counts.should.have.property('pending', 2);
                expect(text).toMatchSnapshot();
            });

            test('pagination playbook_runs?limit=2', async () => {
                base.getSandbox().stub(dispatcher, 'fetchPlaybookRuns').returns(null);
                const {body, text} = await request
                .get('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs?limit=2')
                .set(auth.fifi)
                .expect(200);

                body.meta.count.should.equal(2);
                body.meta.total.should.equal(2);
                body.data[0].should.have.property('id', '55d0ba73-0015-4e7d-a6d6-4b530cbfb6de');
                body.data[0].should.have.property('status', 'running');
                body.data[0].should.have.property('created_at', '2019-12-23T08:19:36.641Z');

                body.data[1].should.have.property('id', '99d0ba73-0015-4e7d-a6d6-4b530cbfb6de');
                body.data[1].should.have.property('status', 'running');
                body.data[1].should.have.property('created_at', '2019-12-23T08:19:36.641Z');

                body.data[0].executors[0].should.have.property('executor_id', '99c0ba73-1015-4e7d-a6d6-4b530cbfb7bd');
                body.data[0].executors[0].should.have.property('executor_name', 'executor-9');
                body.data[0].executors[0].should.have.property('status', 'running');
                body.data[0].executors[0].should.have.property('system_count', 1);
                body.data[0].executors[0].counts.should.have.property('pending', 1);

                body.data[1].executors[0].should.have.property('executor_id', '77c0ba73-1015-4e7d-a6d6-4b530cbfb7bd');
                body.data[1].executors[0].should.have.property('executor_name', 'executor-3');
                body.data[1].executors[0].should.have.property('status', 'running');
                body.data[1].executors[0].should.have.property('system_count', 1);
                body.data[1].executors[0].counts.should.have.property('pending', 1);
                expect(text).toMatchSnapshot();
            });

            test('pagination playbook_runs?limit=1', async () => {
                base.getSandbox().stub(dispatcher, 'fetchPlaybookRuns').returns(null);
                const {body, text} = await request
                .get('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs?limit=1')
                .set(auth.fifi)
                .expect(200);

                body.meta.count.should.equal(1);
                body.meta.total.should.equal(2);
                body.data[0].should.have.property('id', '55d0ba73-0015-4e7d-a6d6-4b530cbfb6de');
                body.data[0].should.have.property('status', 'running');
                body.data[0].should.have.property('created_at', '2019-12-23T08:19:36.641Z');

                body.data[0].executors[0].should.have.property('executor_id', '99c0ba73-1015-4e7d-a6d6-4b530cbfb7bd');
                body.data[0].executors[0].should.have.property('executor_name', 'executor-9');
                body.data[0].executors[0].should.have.property('status', 'running');
                body.data[0].executors[0].should.have.property('system_count', 1);
                body.data[0].executors[0].counts.should.have.property('pending', 1);
                expect(text).toMatchSnapshot();
            });

            test('pagination playbook_runs?offset=1', async () => {
                base.getSandbox().stub(dispatcher, 'fetchPlaybookRuns').returns(null);
                const {body, text} = await request
                .get('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs?offset=1')
                .set(auth.fifi)
                .expect(200);

                body.meta.count.should.equal(1);
                body.meta.total.should.equal(2);
                body.data[0].should.have.property('id', '99d0ba73-0015-4e7d-a6d6-4b530cbfb6de');
                body.data[0].should.have.property('status', 'running');
                body.data[0].should.have.property('created_at', '2019-12-23T08:19:36.641Z');

                body.data[0].executors[0].should.have.property('executor_id', '77c0ba73-1015-4e7d-a6d6-4b530cbfb7bd');
                body.data[0].executors[0].should.have.property('executor_name', 'executor-3');
                body.data[0].executors[0].should.have.property('status', 'running');
                body.data[0].executors[0].should.have.property('system_count', 1);
                body.data[0].executors[0].counts.should.have.property('pending', 1);
                expect(text).toMatchSnapshot();
            });

            test('sort playbook_runs?sort=-updated_at', async() => {
                mockUuid();
                const {body, text} = await request
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs?sort=-updated_at')
                .set(auth.fifi)
                .expect(200);

                body.meta.count.should.equal(2);
                body.meta.total.should.equal(2);
                body.data[0].should.have.property('id', '31a70e85-378a-4436-96e9-677cd6fba660');
                body.data[0].should.have.property('status', 'pending');
                body.data[0].should.have.property('created_at', '2020-02-23T06:19:36.641Z');

                body.data[1].should.have.property('id', '88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc');
                body.data[1].should.have.property('status', 'running');
                body.data[1].should.have.property('created_at', '2019-12-23T08:19:36.641Z');

                body.data[0].executors[0].should.have.property('executor_id', '3ee8f640-ec08-46eb-be77-b80785c476d9');
                body.data[0].executors[0].should.have.property('executor_name', 'executor-25');
                body.data[0].executors[0].should.have.property('status', 'pending');
                body.data[0].executors[0].should.have.property('system_count', 1);
                body.data[0].executors[0].counts.should.have.property('pending', 1);

                body.data[1].executors[0].should.have.property('executor_id', '21a0ba73-1035-4e7d-b6d6-4b530cbfb5bd');
                body.data[1].executors[0].should.have.property('executor_name', 'executor-2');
                body.data[1].executors[0].should.have.property('status', 'running');
                body.data[1].executors[0].should.have.property('system_count', 5);
                body.data[1].executors[0].counts.should.have.property('failure', 3);
                body.data[1].executors[0].counts.should.have.property('canceled', 2);

                body.data[1].executors[1].should.have.property('executor_id', '77c0ba73-1015-4e7d-a6d6-4b530cbfb5bd');
                body.data[1].executors[1].should.have.property('executor_name', 'executor-1');
                body.data[1].executors[1].should.have.property('status', 'running');
                body.data[1].executors[1].should.have.property('system_count', 6);
                body.data[1].executors[1].counts.should.have.property('running', 1);
                body.data[1].executors[1].counts.should.have.property('success', 3);
                body.data[1].executors[1].counts.should.have.property('pending', 2);
                expect(text).toMatchSnapshot();
            });

            test('sort playbook_runs?sort=updated_at', async() => {
                mockUuid();
                const {body, text} = await request
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs?sort=updated_at')
                .set(auth.fifi)
                .expect(200);

                body.meta.count.should.equal(2);
                body.meta.total.should.equal(2);
                body.data[0].should.have.property('id', '88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc');
                body.data[0].should.have.property('status', 'running');
                body.data[0].should.have.property('created_at', '2019-12-23T08:19:36.641Z');

                body.data[1].should.have.property('id', '31a70e85-378a-4436-96e9-677cd6fba660');
                body.data[1].should.have.property('status', 'pending');
                body.data[1].should.have.property('created_at', '2020-02-23T06:19:36.641Z');

                body.data[0].executors[0].should.have.property('executor_id', '21a0ba73-1035-4e7d-b6d6-4b530cbfb5bd');
                body.data[0].executors[0].should.have.property('executor_name', 'executor-2');
                body.data[0].executors[0].should.have.property('status', 'running');
                body.data[0].executors[0].should.have.property('system_count', 5);
                body.data[0].executors[0].counts.should.have.property('failure', 3);
                body.data[0].executors[0].counts.should.have.property('canceled', 2);

                body.data[0].executors[1].should.have.property('executor_id', '77c0ba73-1015-4e7d-a6d6-4b530cbfb5bd');
                body.data[0].executors[1].should.have.property('executor_name', 'executor-1');
                body.data[0].executors[1].should.have.property('status', 'running');
                body.data[0].executors[1].should.have.property('system_count', 6);
                body.data[0].executors[1].counts.should.have.property('running', 1);
                body.data[0].executors[1].counts.should.have.property('success', 3);
                body.data[0].executors[1].counts.should.have.property('pending', 2);

                body.data[1].executors[0].should.have.property('executor_id', '3ee8f640-ec08-46eb-be77-b80785c476d9');
                body.data[1].executors[0].should.have.property('executor_name', 'executor-25');
                body.data[1].executors[0].should.have.property('status', 'pending');
                body.data[1].executors[0].should.have.property('system_count', 1);
                body.data[1].executors[0].counts.should.have.property('pending', 1);
                expect(text).toMatchSnapshot();
            });

            test('playbook_runs/:playbook_run_id', async () => {
                mockUuid();
                const {body, text} = await request
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc')
                .set(auth.fifi)
                .expect(200);

                body.should.have.property('id', '88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc');
                body.should.have.property('status', 'running');
                body.should.have.property('created_at', '2019-12-23T08:19:36.641Z');

                body.executors[0].should.have.property('executor_id', '77c0ba73-1015-4e7d-a6d6-4b530cbfb5bd');
                body.executors[0].should.have.property('executor_name', 'executor-1');
                body.executors[0].should.have.property('status', 'running');
                body.executors[0].should.have.property('system_count', 6);
                body.executors[0].counts.should.have.property('running', 1);
                body.executors[0].counts.should.have.property('success', 3);
                body.executors[0].counts.should.have.property('pending', 2);

                body.executors[1].should.have.property('executor_id', '21a0ba73-1035-4e7d-b6d6-4b530cbfb5bd');
                body.executors[1].should.have.property('executor_name', 'executor-2');
                body.executors[1].should.have.property('system_count', 5);
                body.executors[1].should.have.property('status', 'running');
                body.executors[1].counts.should.have.property('failure', 3);
                body.executors[1].counts.should.have.property('canceled', 2);

                body.executors[2].should.have.property('executor_id', '88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc');
                body.executors[2].should.have.property('executor_name', 'Direct connected');
                body.executors[2].should.have.property('status', 'running');
                body.executors[2].should.have.property('system_count', 1);
                body.executors[2].counts.should.have.property('running', 1);

                expect(text).toMatchSnapshot();
            });

            test('playbook_runs/:playbook_run_id/systems', async () => {
                mockUuid();
                const {body, text} = await request
                .get('/v1/remediations/d12efef0-9580-4c82-b604-9888e2269c5a/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb6bc/systems')
                .set(auth.fifi)
                .expect(200);

                body.meta.count.should.equal(3);
                body.meta.total.should.equal(3);
                body.data.should.have.length(3);

                body.data[0].should.have.property('system_id', 'a68f36f4-b9b1-4eae-b0ad-dc528bf6b17f');
                body.data[0].should.have.property('system_name', 'system-22');
                body.data[0].should.have.property('playbook_run_executor_id', '66d0ba73-0015-4e7d-a6d6-4b530cbfb6bd');

                body.data[1].should.have.property('system_id', '6e64bc58-09be-4f49-b717-c1d469d1ae9c');
                body.data[1].should.have.property('system_name', 'system-23');
                body.data[1].should.have.property('playbook_run_executor_id', '66d0ba73-0015-4e7d-a6d6-4b530cbfb6bd');

                body.data[2].should.have.property('system_id', 'a68f36f4-b9b1-4eae-b0ad-dc528bf6b18f');
                body.data[2].should.have.property('system_name', 'system-24');
                body.data[2].should.have.property('playbook_run_executor_id', '66d0ba73-0015-4e7d-a6d6-4b530cbfb7bd');

                expect(text).toMatchSnapshot();
            });

            test('playbook_runs/:playbook_run_id/systems with RHC systems', async () => {
                mockUuid();
                const {body, text} = await request
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/systems')
                .set(auth.fifi)
                .expect(200);

                body.meta.count.should.equal(12);
                body.meta.total.should.equal(12);
                body.data.should.have.length(12);

                body.data[0].should.have.property('system_id', '8e015e92-02bd-4df1-80c5-3a00b93c4a4a');
                body.data[0].should.have.property('system_name', '8e015e92-02bd-4df1-80c5-3a00b93c4a4a');
                body.data[0].should.have.property('playbook_run_executor_id', '88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc');

                body.data[1].should.have.property('system_id', '7b136dd2-4824-43cf-af6c-ad0ee42f9f97');
                body.data[1].should.have.property('system_name', 'system-1');
                body.data[1].should.have.property('playbook_run_executor_id', '66d0ba73-0015-4e7d-a6d6-4b530cbfb5bd');

                body.data[2].should.have.property('system_id', '3590ba1a-e0df-4092-9c23-bca863b28573');
                body.data[2].should.have.property('system_name', 'system-2');
                body.data[2].should.have.property('playbook_run_executor_id', '66d0ba73-0015-4e7d-a6d6-4b530cbfb5bd');

                expect(text).toMatchSnapshot();
            });

            test('pagination playbook_runs/:playbook_run_id/systems?limit=2', async () => {
                const {body, text} = await request
                .get('/v1/remediations/d12efef0-9580-4c82-b604-9888e2269c5a/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb6bc/systems?limit=2')
                .set(auth.fifi)
                .expect(200);

                body.meta.count.should.equal(2);
                body.meta.total.should.equal(3);
                body.data.should.have.length(2);
                body.data[0].should.have.property('system_id', 'a68f36f4-b9b1-4eae-b0ad-dc528bf6b17f');
                body.data[0].should.have.property('system_name', 'system-22');
                body.data[0].should.have.property('playbook_run_executor_id', '66d0ba73-0015-4e7d-a6d6-4b530cbfb6bd');

                body.data[1].should.have.property('system_id', '6e64bc58-09be-4f49-b717-c1d469d1ae9c');
                body.data[1].should.have.property('system_name', 'system-23');
                body.data[1].should.have.property('playbook_run_executor_id', '66d0ba73-0015-4e7d-a6d6-4b530cbfb6bd');

                expect(text).toMatchSnapshot();
            });

            test('pagination playbook_runs/:playbook_run_id/systems?limit=1&offset=1', async () => {
                const {body, text} = await request
                .get('/v1/remediations/d12efef0-9580-4c82-b604-9888e2269c5a/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb6bc/systems?limit=1&offset=1')
                .set(auth.fifi)
                .expect(200);

                body.meta.count.should.equal(1);
                body.meta.total.should.equal(3);
                body.data.should.have.length(1);
                body.data[0].should.have.property('system_id', '6e64bc58-09be-4f49-b717-c1d469d1ae9c');
                body.data[0].should.have.property('system_name', 'system-23');
                body.data[0].should.have.property('playbook_run_executor_id', '66d0ba73-0015-4e7d-a6d6-4b530cbfb6bd');

                expect(text).toMatchSnapshot();
            });

            test('pagination playbook_runs/:playbook_run_id/systems?limit=1&offset=2', async () => {
                const {body, text} = await request
                .get('/v1/remediations/d12efef0-9580-4c82-b604-9888e2269c5a/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb6bc/systems?limit=1&offset=2')
                .set(auth.fifi)
                .expect(200);

                body.meta.count.should.equal(1);
                body.meta.total.should.equal(3);
                body.data.should.have.length(1);
                body.data[0].should.have.property('system_id', 'a68f36f4-b9b1-4eae-b0ad-dc528bf6b18f');
                body.data[0].should.have.property('system_name', 'system-24');
                body.data[0].should.have.property('playbook_run_executor_id', '66d0ba73-0015-4e7d-a6d6-4b530cbfb7bd');

                expect(text).toMatchSnapshot();
            });

            test('playbook_runs/:playbook_run_id/systems?:executor', async () => {
                const {body, text} = await request
                .get('/v1/remediations/d12efef0-9580-4c82-b604-9888e2269c5a/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb6bc/systems?executor=77c0ba73-1015-4e7d-a6d6-4b530cbfb6bd')
                .set(auth.fifi)
                .expect(200);

                body.meta.count.should.equal(2);
                body.meta.total.should.equal(2);
                body.data.should.have.length(2);
                body.data[0].should.have.property('system_id', 'a68f36f4-b9b1-4eae-b0ad-dc528bf6b17f');
                body.data[0].should.have.property('system_name', 'system-22');
                body.data[0].should.have.property('playbook_run_executor_id', '66d0ba73-0015-4e7d-a6d6-4b530cbfb6bd');

                body.data[1].should.have.property('system_id', '6e64bc58-09be-4f49-b717-c1d469d1ae9c');
                body.data[1].should.have.property('system_name', 'system-23');
                body.data[1].should.have.property('playbook_run_executor_id', '66d0ba73-0015-4e7d-a6d6-4b530cbfb6bd');

                expect(text).toMatchSnapshot();
            });

            test('200s on executor search result that results in 0 systems?executor=88d0ba73-0015-4e7d-a6d6-4b530cbfb111', async () => {
                base.getSandbox().stub(dispatcher, 'fetchPlaybookRuns').returns(null);
                const {body} = await request
                .set(auth.fifi)
                .get('/v1/remediations/d12efef0-9580-4c82-b604-9888e2269c5a/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb6bc/systems?executor=88d0ba73-0015-4e7d-a6d6-4b530cbfb111')
                .expect(200);

                body.meta.count.should.equal(0);
                body.meta.total.should.equal(0);
                body.data.should.have.length(0);
            });

            test('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/systems?ansible_host=system-1', async () => {
                const {body, text} = await request
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/systems?ansible_host=system-1')
                .set(auth.fifi)
                .expect(200);

                body.meta.count.should.equal(1);
                body.meta.total.should.equal(1);
                body.data.should.have.length(1);
                body.data[0].should.have.property('system_id', '7b136dd2-4824-43cf-af6c-ad0ee42f9f97');
                body.data[0].should.have.property('system_name', 'system-1');
                body.data[0].should.have.property('playbook_run_executor_id', '66d0ba73-0015-4e7d-a6d6-4b530cbfb5bd');

                expect(text).toMatchSnapshot();
            });

            test('200s on ansible_host search result that results in 0 systems?ansible_host=system_7896', async () => {
                const {body} = await request
                .set(auth.fifi)
                .get('/v1/remediations/d12efef0-9580-4c82-b604-9888e2269c5a/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb6bc/systems?ansible_host=system_7896')
                .expect(200);

                body.meta.count.should.equal(0);
                body.meta.total.should.equal(0);
                body.data.should.have.length(0);
            });

            test('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/systems?ansible_host=1', async () => {
                const {body, text} = await request
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/systems?ansible_host=1')
                .set(auth.fifi)
                .expect(200);

                body.meta.count.should.equal(1);
                body.meta.total.should.equal(1);
                body.data.should.have.length(1);
                body.data[0].should.have.property('system_id', '7b136dd2-4824-43cf-af6c-ad0ee42f9f97');
                body.data[0].should.have.property('system_name', 'system-1');
                body.data[0].should.have.property('playbook_run_executor_id', '66d0ba73-0015-4e7d-a6d6-4b530cbfb5bd');

                expect(text).toMatchSnapshot();
            });

            test('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/systems?sort=system_name', async () => {
                mockUuid();
                const {body, text} = await request
                .get('/v1/remediations/d12efef0-9580-4c82-b604-9888e2269c5a/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb6bc/systems?sort=system_name')
                .set(auth.fifi)
                .expect(200);

                body.meta.count.should.equal(3);
                body.meta.total.should.equal(3);
                body.data.should.have.length(3);

                body.data[0].should.have.property('system_id', 'a68f36f4-b9b1-4eae-b0ad-dc528bf6b17f');
                body.data[0].should.have.property('system_name', 'system-22');
                body.data[0].should.have.property('playbook_run_executor_id', '66d0ba73-0015-4e7d-a6d6-4b530cbfb6bd');

                body.data[1].should.have.property('system_id', '6e64bc58-09be-4f49-b717-c1d469d1ae9c');
                body.data[1].should.have.property('system_name', 'system-23');
                body.data[1].should.have.property('playbook_run_executor_id', '66d0ba73-0015-4e7d-a6d6-4b530cbfb6bd');

                body.data[2].should.have.property('system_id', 'a68f36f4-b9b1-4eae-b0ad-dc528bf6b18f');
                body.data[2].should.have.property('system_name', 'system-24');
                body.data[2].should.have.property('playbook_run_executor_id', '66d0ba73-0015-4e7d-a6d6-4b530cbfb7bd');

                expect(text).toMatchSnapshot();
            });

            test('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/systems?sort=-system_name', async () => {
                mockUuid();
                const {body, text} = await request
                .get('/v1/remediations/d12efef0-9580-4c82-b604-9888e2269c5a/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb6bc/systems?sort=-system_name')
                .set(auth.fifi)
                .expect(200);

                body.meta.count.should.equal(3);
                body.meta.total.should.equal(3);
                body.data.should.have.length(3);
                body.data[0].should.have.property('system_id', 'a68f36f4-b9b1-4eae-b0ad-dc528bf6b18f');
                body.data[0].should.have.property('system_name', 'system-24');
                body.data[0].should.have.property('playbook_run_executor_id', '66d0ba73-0015-4e7d-a6d6-4b530cbfb7bd');

                body.data[1].should.have.property('system_id', '6e64bc58-09be-4f49-b717-c1d469d1ae9c');
                body.data[1].should.have.property('system_name', 'system-23');
                body.data[1].should.have.property('playbook_run_executor_id', '66d0ba73-0015-4e7d-a6d6-4b530cbfb6bd');

                body.data[2].should.have.property('system_id', 'a68f36f4-b9b1-4eae-b0ad-dc528bf6b17f');
                body.data[2].should.have.property('system_name', 'system-22');
                body.data[2].should.have.property('playbook_run_executor_id', '66d0ba73-0015-4e7d-a6d6-4b530cbfb6bd');

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

            test('playbook_runs/:playbook_run_id/systems/:system with RHC system', async () => {
                mockUuid();
                const {body, text} = await request
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/systems/9ce94170-34a0-4aa6-976a-9728aa4da7a4')
                .set(auth.fifi)
                .expect(200);

                body.should.have.property('system_id', '9ce94170-34a0-4aa6-976a-9728aa4da7a4');
                body.should.have.property('system_name', '17adc41a-a6c6-426a-a0d5-c7ba08954154');
                body.should.have.property('status', 'running');
                body.should.have.property('console', 'console log goes here');
                body.should.have.property('updated_at', '2018-10-04T08:19:36.641Z');
                body.should.have.property('playbook_run_executor_id', '88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc');
                expect(text).toMatchSnapshot();
            });

            test('400 on bad remediationID playbook_runs', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-81f8111/playbook_runs')
                .expect(400);
            });

            test('400 on bad limit playbook_runs?limit=fifi', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-81f8111/playbook_runs?limit=fifi')
                .expect(400);
            });

            test('400 on 0 limit playbook_runs?limit=0', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-81f8111/playbook_runs?limit=0')
                .expect(400);
            });

            test('400 on bad offset playbook_runs?offset=fifi', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-81f8111/playbook_runs?offset=fifi')
                .expect(400);
            });

            test('400 on large limit playbook_runs?limit=12000000000', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-81f8111/playbook_runs?limit=12000000000')
                .expect(400);
            });

            test('400 on large limit playbook_runs?offset=12000000000', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-81f8111/playbook_runs?offset=12000000000')
                .expect(400);
            });

            test('400 on wrong sort playbook_runs?sort=FIFI', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-81f8111/playbook_runs?sort=FIFI')
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

            test('400 on bad playbook_run_id playbook_runs/:playbook_run_id/systems?executor=:executor_id', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a4b530cbfb111/systems?executor=249f142c-2ae3-4c3f-b2ec-c8c5881')
                .expect(400);
            });

            test('400 on 0 limit playbook_runs/:playbook_run_id/systems?limit=0', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a4b530cbfb111/systems?limit=0')
                .expect(400);
            });

            test('400 on bad limit playbook_runs/:playbook_run_id/systems?limit=fifi', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a4b530cbfb111/systems?limit=fifi')
                .expect(400);
            });

            test('400 on bad offset playbook_runs/:playbook_run_id/systems?offset=fifi', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a4b530cbfb111/systems?offset=fifi')
                .expect(400);
            });

            test('400 on very large limit playbook_run_id playbook_runs/:playbook_run_id/systems?limit=2500000000000000000', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb111/systems?limit=2500000000000000000')
                .expect(400);
            });

            test('400 on very large offset playbook_run_id playbook_runs/:playbook_run_id/systems?offset=2500000000000000000', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/d12efef0-9580-4c82-b604-9888e2269c5a/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb6bc/systems?offset=2500000000000000000')
                .expect(400);
            });

            test('400 on bad playbook_run_id playbook_runs/:playbook_run_id/systems?ansible_host=249f142c-2ae3-4c3f-b2ec-c8c5881', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a4b530cbfb111/systems?ansible_host=249f142c-2ae3-4c3f-b2ec-c8c5881')
                .expect(400);
            });

            test('400 on bad sort playbook_runs/:playbook_run_id/systems?sort=FIFI', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a4b530cbfb111/systems?sort=FIFI')
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
                base.getSandbox().stub(dispatcher, 'fetchPlaybookRuns').returns(null);
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8111/playbook_runs')
                .expect(404);
            });

            test('404 on unknown remediationID playbook_runs/:playbook_run_id', async () => {
                base.getSandbox().stub(dispatcher, 'fetchPlaybookRuns').returns(null);
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8111/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc')
                .expect(404);
            });

            test('404 on unknown playbookRunId playbook_runs/:playbook_run_id', async () => {
                base.getSandbox().stub(dispatcher, 'fetchPlaybookRuns').returns(null);
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfbabc')
                .expect(404);
            });

            test('404 on unknown remediationID playbook_runs/:playbook_run_id/systems', async () => {
                base.getSandbox().stub(dispatcher, 'fetchPlaybookRuns').returns(null);
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8111/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/systems')
                .expect(404);
            });

            test('404 on unknown playbook_run_id playbook_runs/:playbook_run_id/systems', async () => {
                base.getSandbox().stub(dispatcher, 'fetchPlaybookRuns').returns(null);
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb111/systems')
                .expect(404);
            });

            test('404 on unknown remediationID playbook_runs/:playbook_run_id/systems/:system', async () => {
                base.getSandbox().stub(dispatcher, 'fetchPlaybookRunHosts').returns(null);
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8111/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/systems/a8c4bbeb-dbcf-4fdb-94bc-19e45e961cb1')
                .expect(404);
            });

            test('404 on unknown playbookRunId playbook_runs/:playbook_run_id/systems/:system', async () => {
                base.getSandbox().stub(dispatcher, 'fetchPlaybookRunHosts').returns(null);
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb111/systems/a8c4bbeb-dbcf-4fdb-94bc-19e45e961cb1')
                .expect(404);
            });

            test('404 on unknown systemId playbook_runs/:playbook_run_id/systems/:system', async () => {
                base.getSandbox().stub(dispatcher, 'fetchPlaybookRunHosts').returns(null);
                await request
                .set(auth.fifi)
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb111/systems/a8c4bbeb-dbcf-4fdb-94bc-19e45e961123')
                .expect(404);
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
                .set('if-match', '"126e-MHacGzIMEd1TEWbdQQBBLW62CF0"')
                .expect(201);
            });

            test('400 post playbook run', async () => {
                await request
                .set(auth.fifi)
                .get('/v1/remediations/66eec356-dd06-4c72-a3b6-ef27d150000/playbook_runs')
                .expect(400);
            });

            test('404 on empty query playbook_runs', async () => {
                await request
                .post('/v1/remediations/b0dd77e5-b7aa-4752-aa66-f79f7a7705b8/playbook_runs')
                .set(auth.fifi)
                .expect(404);
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

            test('execute playbook_run with false smartManagement but with system connected to RHC', async () => {
                base.getSandbox().stub(config, 'isMarketplace').value(true);
                await request
                .post('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs')
                .set(utils.IDENTITY_HEADER, utils.createIdentityHeader('fifi', 'fifi', true, data => {
                    data.entitlements.smart_management = false;
                    return data;
                }))
                .expect(201);
            });

            test('sets ETag', async () => {
                const {headers} = await request
                .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs?pretty')
                .set(auth.fifi)
                .set('if-match', '"126e-MHacGzIMEd1TEWbdQQBBLW62CF0"')
                .expect(201);

                headers.etag.should.equal('"126e-MHacGzIMEd1TEWbdQQBBLW62CF0"');
            });

            test('201s on ETag match', async () => {
                await request
                .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs')
                .set(auth.fifi)
                .set('if-match', '"126e-MHacGzIMEd1TEWbdQQBBLW62CF0"')
                .expect(201);
            });

            test('returns 412 if ETags not match', async () => {
                const {headers} = await request
                .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs')
                .set(auth.fifi)
                .set('if-match', '"1062-Pl88DazTBuJo//SQVNUn6pZAlmk"')
                .expect(412);

                headers.etag.should.equal('"126e-MHacGzIMEd1TEWbdQQBBLW62CF0"');
            });

            test('if if-match is not present, proceed', async () => {
                await request
                .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs')
                .set(auth.fifi)
                .expect(201);
            });

            test('check object being send to receptor connector', async function () {
                mockDate();
                mockUuid();
                // do not create db record
                base.getSandbox().stub(queries, 'insertPlaybookRun').returns();

                const spy = base.getSandbox().spy(receptor, 'postInitialRequest');

                await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .set(auth.fifi)
                .expect(201);

                spy.callCount.should.equal(2);
                expect(spy.args[0]).toMatchSnapshot();
                expect(spy.args[1]).toMatchSnapshot();
            });

            test('if no executors are send to createPlaybookRun', async function () {
                base.getSandbox().stub(fifi, 'getConnectionStatus').resolves([{
                    satId: '5f673055-a9a9-4352-a7b6-8ff42e01db96',
                    receptorId: '5f673055-a9a9-4352-a7b6-8ff42e01db96',
                    systems: ['5f673055-a9a9-4352-a7b6-8ff42e01db96'],
                    type: 'Satellite',
                    name: 'Satellite-1',
                    status: 'disconnected'
                }]);

                const {body} = await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .set(auth.fifi)
                .expect(400);

                body.errors[0].should.have.property('code', 'NO_EXECUTORS');
                body.errors[0].should.have.property('title',
                    'No executors available for Playbook "FiFI playbook 5" (63d92aeb-9351-4216-8d7c-044d171337bc)');
            });

            test('exclude one of the two connected executors', async function () {
                mockDate();
                mockUuid();
                // do not create db record
                base.getSandbox().stub(queries, 'insertPlaybookRun').returns();

                const spy = base.getSandbox().spy(receptor, 'postInitialRequest');

                await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .send({exclude: ['722ec903-f4b5-4b1f-9c2f-23fc7b0ba390']})
                .set(auth.fifi)
                .expect(201);

                spy.callCount.should.equal(1);

                const payload = JSON.parse(spy.firstCall.args[0].payload);
                payload.should.have.property('remediation_id', '63d92aeb-9351-4216-8d7c-044d171337bc');
                payload.should.have.property('playbook_run_id', '249f142c-2ae3-4c3f-b2ec-c8c588999999');
                payload.hosts[0].should.have.equal('35e9b452-e405-499c-9c6e-120010b7b465.example.com');

                expect(spy.args[0]).toMatchSnapshot();
            });

            test('exclude all connected connectors and return 400 NO_EXECUTORS', async function () {
                const {body} = await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .send({exclude: ['722ec903-f4b5-4b1f-9c2f-23fc7b0ba390', '63142926-46a5-498b-9614-01f2f66fd40b', 'RHC']})
                .set(auth.fifi)
                .expect(400);

                body.errors[0].should.have.property('code', 'NO_EXECUTORS');
                body.errors[0].should.have.property('title',
                    'No executors available for Playbook "FiFI playbook 5" (63d92aeb-9351-4216-8d7c-044d171337bc)');
            });

            test('post playbook_runs with wrong exclude statment', async function () {
                await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .send({exclude: 'fifi'})
                .set(auth.fifi)
                .expect(400);
            });

            test('post playbook_runs with exclude statement that doesnt exist', async function () {
                const {body} = await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .send({exclude: ['722ec903-f4b5-4b1f-9c2f-23fc7b0ba380']})
                .set(auth.fifi)
                .expect(400);

                body.errors[0].should.have.property('code', 'UNKNOWN_EXCLUDE');
                body.errors[0].should.have.property('title',
                    'Excluded Executor [722ec903-f4b5-4b1f-9c2f-23fc7b0ba380] not found in list of identified executors');
            });

            test('post playbook_runs with response_mode: diff', async function () {
                mockDate();

                const spy = base.getSandbox().spy(receptor, 'postInitialRequest');

                const {body: {id}} = await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .send({response_mode: 'diff'})
                .set(auth.fifi)
                .expect(201);

                spy.callCount.should.equal(2);

                const payload1 = JSON.parse(spy.firstCall.args[0].payload);
                payload1.should.have.property('remediation_id', '63d92aeb-9351-4216-8d7c-044d171337bc');
                payload1.should.have.property('playbook_run_id', id);
                payload1.hosts[0].should.have.equal('355986a3-5f37-40f7-8f36-c3ac928ce190.example.com');
                payload1.config.should.have.property('text_update_full', false);
                payload1.config.should.have.property('text_update_interval', 5000);

                const payload2 = JSON.parse(spy.secondCall.args[0].payload);
                payload2.should.have.property('remediation_id', '63d92aeb-9351-4216-8d7c-044d171337bc');
                payload2.should.have.property('playbook_run_id', id);
                payload2.hosts[0].should.have.equal('35e9b452-e405-499c-9c6e-120010b7b465.example.com');
                payload2.config.should.have.property('text_update_full', false);
                payload2.config.should.have.property('text_update_interval', 5000);

                const records = await db.playbook_run_executors.findAll({
                    where: {
                        playbook_run_id: id
                    }
                });

                records.should.have.length(2);
                records.forEach(record => record.text_update_full.should.be.false());
            });

            test('post playbook_runs with response_mode: full', async function () {
                mockDate();
                const spy = base.getSandbox().spy(receptor, 'postInitialRequest');

                const {body: {id}} = await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .send({response_mode: 'full'})
                .set(auth.fifi)
                .expect(201);

                spy.callCount.should.equal(2);

                const payload1 = JSON.parse(spy.firstCall.args[0].payload);
                payload1.should.have.property('remediation_id', '63d92aeb-9351-4216-8d7c-044d171337bc');
                payload1.should.have.property('playbook_run_id', id);
                payload1.hosts[0].should.have.equal('355986a3-5f37-40f7-8f36-c3ac928ce190.example.com');
                payload1.config.should.have.property('text_update_full', true);
                payload1.config.should.have.property('text_update_interval', 5000);

                const payload2 = JSON.parse(spy.secondCall.args[0].payload);
                payload2.should.have.property('remediation_id', '63d92aeb-9351-4216-8d7c-044d171337bc');
                payload2.should.have.property('playbook_run_id', id);
                payload2.hosts[0].should.have.equal('35e9b452-e405-499c-9c6e-120010b7b465.example.com');
                payload2.config.should.have.property('text_update_full', true);
                payload2.config.should.have.property('text_update_interval', 5000);

                const records = await db.playbook_run_executors.findAll({
                    where: {
                        playbook_run_id: id
                    }
                });

                records.should.have.length(2);
                records.forEach(record => record.text_update_full.should.be.true());
            });

            test('post playbook_runs with (default response mode)', async function () {
                mockDate();
                const spy = base.getSandbox().spy(receptor, 'postInitialRequest');

                const {body: {id}} = await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .send({response_mode: 'full'})
                .set(auth.fifi)
                .expect(201);

                spy.callCount.should.equal(2);

                const payload1 = JSON.parse(spy.firstCall.args[0].payload);
                payload1.should.have.property('remediation_id', '63d92aeb-9351-4216-8d7c-044d171337bc');
                payload1.should.have.property('playbook_run_id', id);
                payload1.hosts[0].should.have.equal('355986a3-5f37-40f7-8f36-c3ac928ce190.example.com');
                payload1.config.should.have.property('text_update_full', true);
                payload1.config.should.have.property('text_update_interval', 5000);

                const payload2 = JSON.parse(spy.secondCall.args[0].payload);
                payload2.should.have.property('remediation_id', '63d92aeb-9351-4216-8d7c-044d171337bc');
                payload2.should.have.property('playbook_run_id', id);
                payload2.hosts[0].should.have.equal('35e9b452-e405-499c-9c6e-120010b7b465.example.com');
                payload2.config.should.have.property('text_update_full', true);
                payload2.config.should.have.property('text_update_interval', 5000);

                const records = await db.playbook_run_executors.findAll({
                    where: {
                        playbook_run_id: id
                    }
                });

                records.should.have.length(2);
                records.forEach(record => record.text_update_full.should.be.true());
            });

            test('post playbook_runs with response_mode: diff and exclude executors', async function () {
                mockDate();
                mockUuid();
                // do not create db record
                base.getSandbox().stub(queries, 'insertPlaybookRun').returns();

                const spy = base.getSandbox().spy(receptor, 'postInitialRequest');

                await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .send({exclude: ['722ec903-f4b5-4b1f-9c2f-23fc7b0ba390'], response_mode: 'diff'})
                .set(auth.fifi)
                .expect(201);

                spy.callCount.should.equal(1);

                const payload = JSON.parse(spy.firstCall.args[0].payload);
                payload.should.have.property('remediation_id', '63d92aeb-9351-4216-8d7c-044d171337bc');
                payload.should.have.property('playbook_run_id', '249f142c-2ae3-4c3f-b2ec-c8c588999999');
                payload.hosts[0].should.have.equal('35e9b452-e405-499c-9c6e-120010b7b465.example.com');
                payload.config.should.have.property('text_update_full', false);
                payload.config.should.have.property('text_update_interval', 5000);

                expect(spy.args[0]).toMatchSnapshot();
            });

            test('dynamic post playbook_runs with < 200 executors', async function () {
                mockDate();
                mockUuid();

                const spy = base.getSandbox().spy(receptor, 'postInitialRequest');
                base.getSandbox().stub(config.fifi, 'text_update_full').value(false);
                base.getSandbox().stub(queries, 'insertPlaybookRun').returns();
                base.getSandbox().stub(fifi, 'getConnectionStatus').returns([
                    ...Array(150).fill(0).map((value, key) => ({
                        satId: `84762eb3-0bbb-4bd8-ab11-f420c50e9${String(key).padStart(3, '0')}`,
                        receptorId: `d0e7a384-7f8e-4c40-8394-627004225${String(key).padStart(3, '0')}`,
                        endpointId: `${String(key).padStart(3, '0')}`,
                        systems: [
                            {
                                id: '35e9b452-e405-499c-9c6e-120010b7b465',
                                ansible_host: null,
                                hostname: '35e9b452-e405-499c-9c6e-120010b7b465.example.com',
                                display_name: null
                            }
                        ],
                        type: 'satellite',
                        name: 'Dynamic Satellite',
                        status: 'connected'
                    }))
                ]);

                await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .set(auth.fifi)
                .expect(201);

                spy.callCount.should.equal(150);

                const payload = JSON.parse(spy.firstCall.args[0].payload);
                payload.config.text_update_full.should.be.true();
                payload.config.text_update_interval.should.equal(5000);
            });

            test('dynamic post playbook_runs with < 400 executors', async function () {
                mockDate();
                mockUuid();

                const spy = base.getSandbox().spy(receptor, 'postInitialRequest');
                base.getSandbox().stub(config.fifi, 'text_update_full').value(false);
                base.getSandbox().stub(queries, 'insertPlaybookRun').returns();
                base.getSandbox().stub(fifi, 'getConnectionStatus').returns([
                    ...Array(300).fill(0).map((value, key) => ({
                        satId: `84762eb3-0bbb-4bd8-ab11-f420c50e9${String(key).padStart(3, '0')}`,
                        receptorId: `d0e7a384-7f8e-4c40-8394-627004225${String(key).padStart(3, '0')}`,
                        endpointId: `${String(key).padStart(3, '0')}`,
                        systems: [
                            {
                                id: '35e9b452-e405-499c-9c6e-120010b7b465',
                                ansible_host: null,
                                hostname: '35e9b452-e405-499c-9c6e-120010b7b465.example.com',
                                display_name: null
                            }
                        ],
                        type: 'satellite',
                        name: 'Dynamic Satellite',
                        status: 'connected'
                    }))
                ]);

                await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .set(auth.fifi)
                .expect(201);

                spy.callCount.should.equal(300);

                const payload = JSON.parse(spy.firstCall.args[0].payload);
                payload.config.text_update_full.should.be.false();
                payload.config.text_update_interval.should.equal(30000);
            });

            test('dynamic post playbook_runs with >= 400 executors', async function () {
                mockDate();
                mockUuid();

                const spy = base.getSandbox().spy(receptor, 'postInitialRequest');
                base.getSandbox().stub(config.fifi, 'text_update_full').value(false);
                base.getSandbox().stub(queries, 'insertPlaybookRun').returns();
                base.getSandbox().stub(fifi, 'getConnectionStatus').returns([
                    ...Array(500).fill(0).map((value, key) => ({
                        satId: `84762eb3-0bbb-4bd8-ab11-f420c50e9${String(key).padStart(3, '0')}`,
                        receptorId: `d0e7a384-7f8e-4c40-8394-627004225${String(key).padStart(3, '0')}`,
                        endpointId: `${String(key).padStart(3, '0')}`,
                        systems: [
                            {
                                id: '35e9b452-e405-499c-9c6e-120010b7b465',
                                ansible_host: null,
                                hostname: '35e9b452-e405-499c-9c6e-120010b7b465.example.com',
                                display_name: null
                            }
                        ],
                        type: 'satellite',
                        name: 'Dynamic Satellite',
                        status: 'connected'
                    }))
                ]);

                await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .set(auth.fifi)
                .expect(201);

                spy.callCount.should.equal(500);

                const payload = JSON.parse(spy.firstCall.args[0].payload);
                payload.config.text_update_full.should.be.false();
                payload.config.text_update_interval.should.equal(60000);
            });

            test('400 if response_mode is wrong', async function () {
                await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .send({response_mode: 'fifi'})
                .set(auth.fifi)
                .expect(400);
            });

            test('400 if response_mode is wrong with right exclude', async function () {
                await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .send({response_mode: 'something', exclude: ['722ec903-f4b5-4b1f-9c2f-23fc7b0ba390']})
                .set(auth.fifi)
                .expect(400);
            });

            test('400 if exclude is wrong with right response_mode', async function () {
                await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .send({response_mode: 'diff', exclude: ['fifi']})
                .set(auth.fifi)
                .expect(400);
            });

            test('if 1st executor result from receptor connector is request error', async function () {
                base.getSandbox().stub(receptor, 'postInitialRequest')
                .rejects(errors.internal.dependencyError(new Error('receptor down'), receptor));

                const {body} = await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .set(auth.fifi)
                .expect(503);

                body.errors[0].should.have.property('code', 'DEPENDENCY_UNAVAILABLE');
                body.errors[0].details.should.have.property('name', 'receptor');
                body.errors[0].details.should.have.property('impl', 'mock');
            });

            test('if 2nd executor result from receptor is request error', async function () {
                const stub = base.getSandbox().stub(receptor, 'postInitialRequest');
                stub.callThrough();
                stub.onSecondCall().rejects(errors.internal.dependencyError(new Error('receptor down'), receptor));

                const {body} =  await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .set(auth.fifi)
                .expect(201);

                body.should.have.property('id');
            });

            test('cancel playbook when 2 of 2 executors are still running', async () => {
                const spy = base.getSandbox().spy(receptor, 'postInitialRequest');
                await request
                .post('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/cancel')
                .set(auth.fifi)
                .expect(202);

                spy.callCount.should.equal(2);
                spy.firstCall.args[0].should.eql({
                    account: 'fifi',
                    recipient: 'Job-1',
                    payload: '{"type":"playbook_run_cancel","playbook_run_id":"88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc"}',
                    directive: 'receptor_satellite:cancel'
                });

                spy.secondCall.args[0].should.eql({
                    account: 'fifi',
                    recipient: 'Job-2',
                    payload: '{"type":"playbook_run_cancel","playbook_run_id":"88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc"}',
                    directive: 'receptor_satellite:cancel'
                });
            });

            test('cancel playbook when no executors are still running', async () => {
                const spy = base.getSandbox().spy(receptor, 'postInitialRequest');
                await request
                .post('/v1/remediations/d12efef0-9580-4c82-b604-9888e2269c5a/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb7bc/cancel')
                .set(auth.fifi)
                .expect(404);

                spy.callCount.should.equal(0);
            });

            test('cancel playbook when 2 of 3 executors are still running', async () => {
                const spy = base.getSandbox().spy(receptor, 'postInitialRequest');
                await request
                .post('/v1/remediations/d12efef0-9580-4c82-b604-9888e2269c5a/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb6bc/cancel')
                .set(auth.fifi)
                .expect(202);

                spy.callCount.should.equal(2);
            });
        });
    });

    describe('RBAC', function () {
        test('if user has correct RBAC permissions', async function () {
            base.getSandbox().stub(rbac, 'getRemediationsAccess').resolves(buildRbacResponse('remediations:*:*'));

            await request
            .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
            .set(auth.fifi)
            .expect(201);
        });

        test('if user does not have correct RBAC permissions', async function () {
            base.getSandbox().stub(rbac, 'getRemediationsAccess').resolves(buildRbacResponse('remediations:remediation:write'));

            const {body} = await request
            .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
            .set(auth.fifi)
            .expect(403);

            body.errors[0].details.message.should.equal(
                'Permission remediations:remediation:execute is required for this operation'
            );
        });

        test('if RBAC connector returns no permissions at all', async function () {
            base.getSandbox().stub(rbac, 'getRemediationsAccess').resolves([]);

            const {body} = await request
            .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
            .set(auth.fifi)
            .expect(403);

            body.errors[0].details.message.should.equal(
                'Permission remediations:remediation:execute is required for this operation'
            );
        });

        test('if RBAC connector fails a dependency error is returned', async function () {
            base.getSandbox().stub(rbac, 'getRemediationsAccess')
            .rejects(errors.internal.dependencyError(new Error('rbac down'), rbac));

            const {body} = await request
            .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
            .set(auth.fifi)
            .expect(503);

            body.errors[0].should.have.property('code', 'DEPENDENCY_UNAVAILABLE');
            body.errors[0].details.should.have.property('name', 'rbac');
            body.errors[0].details.should.have.property('impl', 'mock');
        });
    });

    describe('scenario tests', function () {
        async function getSystem (run, system) {
            const {body} = await request
            .get(`/v1/remediations/d12efef0-9580-4c82-b604-9888e2269c5a/playbook_runs/${run}/systems/${system}`)
            .set(auth.fifi)
            .expect(200);

            return body;
        }

        test('create playbook run', async () => {
            const {body: post} = await request
            .post('/v1/remediations/d12efef0-9580-4c82-b604-9888e2269c5a/playbook_runs')
            .set(auth.fifi)
            .set('if-match', '"126e-MHacGzIMEd1TEWbdQQBBLW62CF0"')
            .expect(201);

            const {body: run} = await request
            .get(`/v1/remediations/d12efef0-9580-4c82-b604-9888e2269c5a/playbook_runs/${post.id}`)
            .set(auth.fifi)
            .expect(200);

            run.should.have.property('status', 'pending');
            run.should.have.property('remediation_id', 'd12efef0-9580-4c82-b604-9888e2269c5a');
            run.should.have.property('created_by', { username: 'fifi', first_name: 'test', last_name: 'user' });
            run.should.have.property('created_at');
            run.should.have.property('updated_at');
            run.executors.should.have.length(2);

            run.executors[0].should.have.property('executor_name', 'Satellite 1 (connected)');
            run.executors[0].should.have.property('executor_id', '722ec903-f4b5-4b1f-9c2f-23fc7b0ba390');
            run.executors[0].should.have.property('playbook_run_id', post.id);
            run.executors[0].should.have.property('status', 'pending');
            run.executors[0].should.have.property('system_count', 3);
            run.executors[0].should.have.property('updated_at');
            run.executors[0].should.have.property('playbook');

            run.executors[1].should.have.property('executor_name', 'Satellite 4 (connected)');
            run.executors[1].should.have.property('executor_id', '63142926-46a5-498b-9614-01f2f66fd40b');
            run.executors[1].should.have.property('playbook_run_id', post.id);
            run.executors[1].should.have.property('status', 'pending');
            run.executors[1].should.have.property('system_count', 1);
            run.executors[1].should.have.property('updated_at');
            run.executors[1].should.have.property('playbook');

            const {body: systems} = await request
            .get(`/v1/remediations/d12efef0-9580-4c82-b604-9888e2269c5a/playbook_runs/${post.id}/systems`)
            .set(auth.fifi)
            .expect(200);

            systems.should.have.property('meta', {
                count: 4,
                total: 4
            });

            systems.data.should.have.length(4);
            systems.data[0].should.have.property('system_id', '355986a3-5f37-40f7-8f36-c3ac928ce190');
            systems.data[0].should.have.property('system_name', '355986a3-5f37-40f7-8f36-c3ac928ce190.example.com');
            systems.data[0].should.have.property('status', 'pending');
            systems.data[0].should.have.properties('updated_at', 'playbook_run_executor_id');

            systems.data[1].should.have.property('system_id', '35e9b452-e405-499c-9c6e-120010b7b465');
            systems.data[1].should.have.property('system_name', '35e9b452-e405-499c-9c6e-120010b7b465.example.com');
            systems.data[1].should.have.property('status', 'pending');
            systems.data[1].should.have.properties('updated_at', 'playbook_run_executor_id');

            systems.data[2].should.have.property('system_id', 'b84f4322-a0b8-4fb9-a8dc-8abb9ee16bc0');
            systems.data[2].should.have.property('system_name', 'b84f4322-a0b8-4fb9-a8dc-8abb9ee16bc0');
            systems.data[2].should.have.property('status', 'pending');
            systems.data[2].should.have.properties('updated_at', 'playbook_run_executor_id');

            systems.data[3].should.have.property('system_id', 'd5174274-4307-4fac-84fd-da2c3497657c');
            systems.data[3].should.have.property('system_name', 'd5174274-4307-4fac-84fd-da2c3497657c');
            systems.data[3].should.have.property('status', 'pending');
            systems.data[3].should.have.properties('updated_at', 'playbook_run_executor_id');

            const system0 = await getSystem(post.id, systems.data[0].system_id);
            system0.should.have.property('system_id', systems.data[0].system_id);
            system0.should.have.property('system_name', '355986a3-5f37-40f7-8f36-c3ac928ce190.example.com');
            system0.should.have.property('status', 'pending');
            system0.should.have.property('console', '');
            system0.should.have.properties('updated_at', 'playbook_run_executor_id');

            const system1 = await getSystem(post.id, systems.data[1].system_id);
            system1.should.have.property('system_id', systems.data[1].system_id);
            system1.should.have.property('system_name', '35e9b452-e405-499c-9c6e-120010b7b465.example.com');
            system1.should.have.property('status', 'pending');
            system1.should.have.property('console', '');
            system1.should.have.properties('updated_at', 'playbook_run_executor_id');

            const system2 = await getSystem(post.id, systems.data[2].system_id);
            system2.should.have.property('system_id', systems.data[2].system_id);
            system2.should.have.property('system_name', 'b84f4322-a0b8-4fb9-a8dc-8abb9ee16bc0');
            system2.should.have.property('status', 'pending');
            system2.should.have.property('console', '');
            system2.should.have.properties('updated_at', 'playbook_run_executor_id');

            const system3 = await getSystem(post.id, systems.data[3].system_id);
            system3.should.have.property('system_id', systems.data[3].system_id);
            system3.should.have.property('system_name', 'd5174274-4307-4fac-84fd-da2c3497657c');
            system3.should.have.property('status', 'pending');
            system3.should.have.property('console', '');
            system3.should.have.properties('updated_at', 'playbook_run_executor_id');
        });

        test('create playbook run (with 2nd executor failing)', async () => {
            const stub = base.getSandbox().stub(receptor, 'postInitialRequest');
            stub.callThrough();
            stub.onSecondCall().rejects(errors.internal.dependencyError(new Error('receptor down'), receptor));

            const {body: post} = await request
            .post('/v1/remediations/d12efef0-9580-4c82-b604-9888e2269c5a/playbook_runs')
            .set(auth.fifi)
            .expect(201);

            stub.callCount.should.equal(2);

            const {body: run} = await request
            .get(`/v1/remediations/d12efef0-9580-4c82-b604-9888e2269c5a/playbook_runs/${post.id}`)
            .set(auth.fifi)
            .expect(200);

            run.should.have.property('status', 'pending');
            run.executors.should.have.length(2);

            run.executors[0].should.have.property('executor_id', '722ec903-f4b5-4b1f-9c2f-23fc7b0ba390');
            run.executors[0].should.have.property('status', 'pending');
            run.executors[0].should.have.property('system_count', 3);

            run.executors[1].should.have.property('executor_id', '63142926-46a5-498b-9614-01f2f66fd40b');
            run.executors[1].should.have.property('status', 'failure');
            run.executors[1].should.have.property('system_count', 1);

            const {body: systems} = await request
            .get(`/v1/remediations/d12efef0-9580-4c82-b604-9888e2269c5a/playbook_runs/${post.id}/systems`)
            .set(auth.fifi)
            .expect(200);

            systems.data.should.have.length(4);
            systems.data[0].should.have.property('status', 'pending');
            systems.data[1].should.have.property('status', 'failure');
            systems.data[2].should.have.property('status', 'pending');
            systems.data[3].should.have.property('status', 'pending');
        });
    });
});
