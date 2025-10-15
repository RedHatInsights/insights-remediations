/*eslint-disable max-len*/
'use strict';
const P = require('bluebird');
const _ = require('lodash');
const URI = require('urijs');
const queryString = require('querystring');

const { request, auth, mockDate, buildRbacResponse, sandbox} = require('../test');
const sinon = require('sinon');

const utils = require('../middleware/identity/utils');
const configManager = require('../connectors/configManager');
const receptor = require('../connectors/receptor');
const fifi = require('../remediations/fifi');
const fifi_2 = require('../remediations/fifi_2');
const base = require('../test');
const errors = require('../errors');
const rbac = require('../connectors/rbac');
const queries = require('./remediations.queries');
const dispatcher = require('../connectors/dispatcher');
const dispatcher_impl = require('../connectors/dispatcher/impl');
const dispatcher_mock = require('../connectors/dispatcher/mock');
const Connector = require('../connectors/Connector');
const config = require('../config');
const db = require('../db');
const { systems } = require('../connectors/inventory/impl.unit.data');

// Helper functions
function fake_doHttp(req) {
    const uri = new URI(req.uri);
    const path = uri.path();

    if (path === '/api/playbook-dispatcher/v1/runs')
        return fake_dispatcher_runs(req);

    if (path === '/api/playbook-dispatcher/v1/run_hosts')
        return fake_dispatcher_run_hosts(req);

    return Promise.resolve({});
}

function fake_dispatcher_runs(req) {
    const uri = new URI(req.uri);
    const params = queryString.parse(uri.query());
    const offset = parseInt(params.offset) || 0;

    // grab next chunk of systems...
    const ids = systems.slice(offset, offset + 50);

    // construct response container
    const resp = {
        data: [],
        links: {},
        meta: {}
    };

    if ((offset + ids.length) < systems.length) {
        params.offset = offset + 50;
        uri.query(params);
        resp.links.next = uri.toString();
    }

    resp.meta.count = ids.length;
    resp.meta.total = systems.length;

    resp.data = ids.map((id) => {
        return {
            "id": id,
            "created_at": "2024-03-19T20:57:35.75356Z",
            "updated_at": "2024-03-19T20:59:31.283793Z",
            "labels": {
                "playbook-run": "11f7f24a-346b-405c-8dcc-c953511fb21c"
            },
            "recipient": id,
            "service": "remediations",
            "status": "success",
            "url": "https://cert.cloud.stage.redhat.com/api/remediations/v1/remediations/dd6a0b1b-5331-4e7b-92ec-9a01806fb181/playbook?hosts=6f23462c-df72-455f-8b2f-d5ae6f3b617b&localhost"
        };
    })

    return Promise.resolve(resp);
}

// For now, this just fakes a single run host for direct targets
function fake_dispatcher_run_hosts(req) {
    const uri = new URI(req.uri);
    const params = queryString.parse(uri.query());

    // construct response
    const resp = {
        data: [{
            "host": "localhost",
            "inventory_id": params['filter[run][id]'],
            "status": "success",
            "stdout": "[WARNING]: provided hosts list is empty, only localhost is available. Note that the implicit localhost does not match 'all'\r\nPLAY [Set owner and permissions on /etc/sshd/sshd_config to root:root 0600] ****\r\nTASK [Gathering Facts] *********************************************************ok: [localhost]\r\nTASK [Set the owner and permissions of ssh config file to root:root 0600] ******changed: [localhost]\r\nPLAY [run insights] ************************************************************\r\nTASK [run insights] ************************************************************ok: [localhost]\r\nPLAY RECAP *********************************************************************\r\nlocalhost                  : ok=3    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   \r\n"
        }],
        links: {},
        meta: {
            count: 1,
            total:1
        }
    };

    return Promise.resolve(resp);
}


// TODO: replace old receptor tests and improve rhc-satellite test coverage
describe('FiFi', function () {
    describe('executable', function () {
        test('remediation is executable with valid remediation id', async () => {
            await request
            .get('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/executable')
            .set(auth.fifi)
            .expect(200);
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

        test('handles > 50 systems', async () => {
            // use impl version
            base.getSandbox().stub(dispatcher, 'getConnectionStatus').callsFake(dispatcher_impl.getConnectionStatus);

            // replace request() with our own function...
            const http_request = require('../util/request');
            const dispatcherMock = require('../connectors/dispatcher/serviceMock');
            base.getSandbox().stub(http_request, 'run').callsFake(dispatcherMock);


            const result = await request
            .get('/v1/remediations/dd6a0b1b-5331-4e7b-92ec-9a01806fb181/connection_status')
            .set(auth.fifi);

            expect(result.body).toMatchSnapshot();
        });

        test('get connection status with false smartManagement but with system connected to RHC', async () => {
            base.getSandbox().stub(config, 'isMarketplace').value(true);
            const {text} = await request
            .get('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/connection_status?pretty')
            .set(utils.IDENTITY_HEADER, utils.createIdentityHeader('fifi', 'fifi', '6666666', true, data => {
                return data;
            }))
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
                return data;
            }))
            .expect(403);
        });

        test.skip('get connection status with false smartManagement but not configured with config manager', async () => {
            base.getSandbox().stub(config, 'isMarketplace').value(true);
            base.getSandbox().stub(configManager, 'getCurrentProfile').resolves({
                account_id: '654321',
                active: true,
                created_at: '2024-02-14T16:05:43.373531Z',
                creator: 'redhat',
                name: '6089719-a2789bb0-3702-4d63-97de-a68374d871ad',
                org_id: '11789772',
                id: 'c5639a03-4640-4ae3-93ce-9966cae18df7',
                label: 'b7839a03-4640-4ae3-93ce-9966cae18df8',
                compliance: true,
                insights: true,
                remediations: false
            });
            const {text} = await request
            .get('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/connection_status?pretty')
            .set(utils.IDENTITY_HEADER, utils.createIdentityHeader('fifi', 'fifi', '6666666', true, data => {
                return data;
            }))
            .expect(200);

            expect(text).toMatchSnapshot();
        });

        test.skip('get connection status with smartManagement but not enabled with config manager', async () => {
            base.getSandbox().stub(config, 'isMarketplace').value(true);
            base.getSandbox().stub(configManager, 'getCurrentProfile').resolves({
                account_id: '654321',
                active: true,
                created_at: '2024-02-14T16:05:43.373531Z',
                creator: 'redhat',
                name: '6089719-a2789bb0-3702-4d63-97de-a68374d871ad',
                org_id: '11789772',
                id: 'c5639a03-4640-4ae3-93ce-9966cae18df7',
                label: 'b7839a03-4640-4ae3-93ce-9966cae18df8',
                compliance: true,
                insights: true,
                remediations: false
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

            headers.etag.should.equal('"b48-TyVONjo4V6eLe5E3p90RxLra8So"');
        });

        test('304s on ETag match', async () => {
            await request
            .get('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/connection_status?pretty')
            .set(auth.fifi)
            .set('if-none-match', '"b48-TyVONjo4V6eLe5E3p90RxLra8So"')
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

                body.meta.count.should.equal(2);
                body.meta.total.should.equal(2);
                body.data[0].should.have.property('id', '31a70e85-378a-4436-96e9-677cd6fba660');
                body.data[0].should.have.property('status', 'running');
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
                const {body, text} = await request
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs?sort=-updated_at')
                .set(auth.fifi)
                .expect(200);

                body.meta.count.should.equal(2);
                body.meta.total.should.equal(2);
                body.data[0].should.have.property('id', '31a70e85-378a-4436-96e9-677cd6fba660');
                body.data[0].should.have.property('status', 'running');
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
                body.data[1].should.have.property('status', 'running');
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

            test('playbook_runs/:playbook_run_id RHC-direct status aggregation', async () => {
                // remediation id: efe9fd2b-fdbd-4c74-93e7-8c69f1b668f3 is a remediation plan
                // with two direct hosts for each Playbook-Dispatcher status: running, success, failure, timeout, canceled
                const {body, text} = await request
                    .get('/v1/remediations/efe9fd2b-fdbd-4c74-93e7-8c69f1b668f3/playbook_runs/8ff5717a-cce8-4738-907b-a89eaa559275')
                    .set(auth.testStatus)
                    .expect(200);

                expect(text).toMatchSnapshot();
            });

            test('playbook_runs/:playbook_run_id/systems', async () => {
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
                const {body, text} = await request
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/systems')
                .set(auth.fifi)
                .expect(200);

                body.meta.count.should.equal(12);
                body.meta.total.should.equal(12);
                body.data.should.have.length(12);

                body.data[0].should.have.property('system_id', '07adc41a-a6c6-426a-a0d5-c7ba08954153');
                body.data[0].should.have.property('system_name', '07adc41a-a6c6-426a-a0d5-c7ba08954153.example.com');
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

            test('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc/systems?sort=system_name', async () => {
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
                const {body, text} = await request
                .get('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs/31a70e85-378a-4436-96e9-677cd6fba660/systems/17adc41a-a6c6-426a-a0d5-c7ba08954154')
                .set(auth.fifi)
                .expect(200);

                body.should.have.property('system_id', '17adc41a-a6c6-426a-a0d5-c7ba08954154');
                body.should.have.property('system_name', '17adc41a-a6c6-426a-a0d5-c7ba08954154.example.com');
                body.should.have.property('status', 'running');
                body.should.have.property('console', 'console log goes here');
                body.should.have.property('updated_at', '2018-10-04T08:19:36.641Z');
                body.should.have.property('playbook_run_executor_id', '31a70e85-378a-4436-96e9-677cd6fba660');
                expect(text).toMatchSnapshot();
            });

            test('playbook_runs/:playbook_run_id with >50 direct systems', async () => {
                // use the impl version of dispatcher functions...
                base.getSandbox().stub(dispatcher, 'fetchPlaybookRuns').callsFake(dispatcher_impl.fetchPlaybookRuns);
                base.getSandbox().stub(dispatcher, 'fetchPlaybookRunHosts').callsFake(dispatcher_impl.fetchPlaybookRunHosts);

                // replace doHttp() with our own function...
                const spy = base.getSandbox().stub(Connector.prototype, 'doHttp');
                spy.callsFake(fake_doHttp);

                const {body} = await request
                    .get('/v1/remediations/dd6a0b1b-5331-4e7b-92ec-9a01806fb181/playbook_runs/11f7f24a-346b-405c-8dcc-c953511fb21c')
                    .set(auth.fifi)
                    .expect(200);

                expect(body).toMatchSnapshot();
            });

            // TODO: write this!
            // test('playbook_runs/:playbook_run_id with >50 satellite systems', async () => {});

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
            test('post playbook run with 5k hosts', async () => {
                // TODO: finish this!
                base.getSandbox().stub(dispatcher, 'postPlaybookRunRequests').callsFake(dispatcher_impl.postRunRequests);

                await request
                    .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs')
                    .set(auth.fifi)
                    .set('if-match', '"b48-TyVONjo4V6eLe5E3p90RxLra8So"')
                    .expect(201);
            });

            test('post playbook run and store dispatcher runs', async () => {
                const sandbox = base.getSandbox();
                const { v4: uuidv4 } = require('uuid');

                const remediationId = '0ecb5db7-2f1a-441b-8220-e5ce45066f50';
                const fakeRunId = uuidv4();
                sandbox.stub(fifi_2, 'uuidv4').returns(fakeRunId);

                const dispatcherResponse = [
                    { code: 200, id: uuidv4() },
                    { code: 200, id: uuidv4() }
                ];

                sandbox.stub(dispatcher, 'postV2PlaybookRunRequests').resolves(dispatcherResponse);

                await request
                .post(`/v1/remediations/${remediationId}/playbook_runs`)
                .set(auth.fifi)
                .expect(201);

                const inserted = await db.dispatcher_runs.findAll({
                    where: { remediations_run_id: fakeRunId },
                    raw: true
                });

                expect(inserted).toHaveLength(2);
                expect(inserted).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            dispatcher_run_id: dispatcherResponse[0].id,
                            remediations_run_id: fakeRunId,
                            status: 'pending'
                        }),
                        expect.objectContaining({
                            dispatcher_run_id: dispatcherResponse[1].id,
                            remediations_run_id: fakeRunId,
                            status: 'pending'
                        })
                    ])
                );
            });

            test('post playbook run with dispatcher partial failure - saves all runs and returns 201', async function () {
                const sandbox = base.getSandbox();
                const { v4: uuidv4 } = require('uuid');

                const remediationId = '0ecb5db7-2f1a-441b-8220-e5ce45066f50';
                const fakeRunId = uuidv4();
                sandbox.stub(fifi_2, 'uuidv4').returns(fakeRunId);

                const dispatcherResponse = [
                    { code: 200, id: uuidv4() },
                    { code: 200, id: uuidv4() },
                    { code: 400, id: uuidv4() },
                    { code: 200, id: uuidv4() },
                    { code: 500, id: uuidv4() },
                    { code: 200, id: uuidv4() },
                    { code: 200, id: uuidv4() },
                    { code: 200, id: uuidv4() },
                    { code: 200, id: uuidv4() }
                ];

                sandbox.stub(dispatcher, 'postV2PlaybookRunRequests').resolves(dispatcherResponse);

                const {body} = await request
                .post(`/v1/remediations/${remediationId}/playbook_runs`)
                .set(auth.fifi)
                .expect(201);
                
                // Should return the run ID successfully despite partial failures
                body.should.have.property('id', fakeRunId);

                const inserted = await db.dispatcher_runs.findAll({
                    where: { remediations_run_id: fakeRunId },
                    raw: true
                });

                expect(inserted).toHaveLength(9);
                
                // Check that we have the correct response codes saved
                const responseCodes = inserted.map(run => run.pd_response_code).sort();
                expect(responseCodes).toEqual([200, 200, 200, 200, 200, 200, 200, 400, 500]);
                
                // Verify that each response has a dispatcher_run_id
                inserted.forEach(run => {
                    expect(run.dispatcher_run_id).toBeDefined();
                    expect(run.remediations_run_id).toBe(fakeRunId);
                });
            });

            test('post playbook run temp test', async () => {
                const TEST_DATA = {
                    org_id: '12345',
                    hosts: [
                        '22ecb605-9edb-464a-84dd-5f04d9b88a76',  // sat_1, org_2
                        '8050118c-a6c8-4693-9812-7c8dfeb8d947',  // sat_1, org_6
                        '55a77c70-c49b-44c1-82f2-bdfd75ae5494',  // sat_2
                        '1fc82531-19c2-425a-ad10-2a4c0e472a44',  // direct
                        'fc94beb8-21ee-403d-99b1-949ef7adb762',
                        '4bb19a8a-0c07-4ee6-a78c-504dab783cc8',
                    ]
                };

                //
                // 8f75807b-ec2b-4b5f-97db-2b18273ff009
                // 72a7651a-a091-4244-87c9-6e3e67a37a4a
                // d3a881aa-bb10-48cc-b288-9388cadbf9bc
                // 48df8af0-6b2f-4d17-a935-bc9687236959
                // bc5faf05-9475-4e1f-970b-fc014f8881f9
                // ff7790e7-e609-49eb-8326-d1ba0d9c2467
                // 8bf3c01d-794d-40ab-9e2d-f4cdebfdad08
                // 7bba9cb3-65dc-4cc3-b948-0fefadd003a0
                // dd9d9605-41f1-4b8e-b7d3-05492d62a0ce
                // 263f4a3a-5cb7-44eb-a17c-d71b8fea248d
                // 6bdcae10-875f-4d76-b8a8-434f929e3271
                // cbc4e887-2dbb-41a7-8e58-ff5e766ea6e7
                // c061da50-e9eb-43be-9cea-751a8d64d8d9
                // b76f065b-2ec6-4022-8bde-91dc1df6b344

                const result = dispatcher_mock.getConnectionStatus(TEST_DATA);

                // await request
                //     .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs')
                //     .set(auth.fifi)
                //     .expect(201);
            });

            test('post playbook run', async () => {
                await request
                .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs')
                .set(auth.fifi)
                .set('if-match', '"b48-TyVONjo4V6eLe5E3p90RxLra8So"')
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
                    return data;
                }))
                .expect(403);
            });

            test('execute playbook_run with false smartManagement but with system connected to RHC', async () => {
                base.getSandbox().stub(config, 'isMarketplace').value(true);
                await request
                .post('/v1/remediations/249f142c-2ae3-4c3f-b2ec-c8c5881f8561/playbook_runs')
                .set(utils.IDENTITY_HEADER, utils.createIdentityHeader('fifi', 'fifi', '6666666', true, data => {
                    return data;
                }))
                .expect(201);
            });

            test('sets ETag', async () => {
                const {headers} = await request
                .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs?pretty')
                .set(auth.fifi)
                .set('if-match', '"b48-TyVONjo4V6eLe5E3p90RxLra8So"')
                .expect(201);

                headers.etag.should.equal('"b48-TyVONjo4V6eLe5E3p90RxLra8So"');
            });

            test('201s on ETag match', async () => {
                await request
                .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs')
                .set(auth.fifi)

                .set('if-match', '"b48-TyVONjo4V6eLe5E3p90RxLra8So"')
                .expect(201);
            });

            test('returns 412 if ETags not match', async () => {
                const {headers} = await request
                .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs')
                .set(auth.fifi)
                .set('if-match', '"1062-Pl88DazTBuJo//SQVNUn6pZAlmk"')
                .expect(412);

                headers.etag.should.equal('"b48-TyVONjo4V6eLe5E3p90RxLra8So"');
            });

            test('if if-match is not present, proceed', async () => {
                await request
                .post('/v1/remediations/0ecb5db7-2f1a-441b-8220-e5ce45066f50/playbook_runs')
                .set(auth.fifi)
                .expect(201);
            });

            test.skip('check object being send to receptor connector', async function () {
                mockDate();
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

            test.skip('if no executors are send to createPlaybookRun', async function () {
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

            test('exclude one of the connected executors', async function () {
                mockDate();

                // do not create db record
                base.getSandbox().stub(queries, 'insertRHCPlaybookRun').returns();

                // force uuid for snapshot test
                base.getSandbox().stub(fifi_2, 'uuidv4').returns('b995e750-c1d3-4c5b-a3ec-eee897ee9065');

                const spy = base.getSandbox().spy(dispatcher, 'postV2PlaybookRunRequests');

                await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .send({exclude: ['722ec903-f4b5-4b1f-9c2f-23fc7b0ba390']})
                .set(auth.fifi)
                .expect(201);

                spy.callCount.should.equal(1);

                const payload = spy.firstCall.args[0];

                payload.should.have.length(8);

                expect(spy.args).toMatchSnapshot();
            });

            test('exclude all connected connectors and return 400 NO_EXECUTORS', async function () {
                const {body} = await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .send({exclude: [
                    '722ec903-f4b5-4b1f-9c2f-23fc7b0ba390',
                    '72f44b25-64a7-4ee7-a94e-3beed9393972',
                    '63142926-46a5-498b-9614-01f2f66fd40b',
                    '893f2788-c7a6-4cc3-89bc-9066ffda695e',
                    '01bf542e-6092-485c-ba04-c656d77f988a',
                    '409dd231-6297-43a6-a726-5ce56923d624',
                    'RHC']})
                .set(auth.fifi)
                .expect(422);

                body.errors[0].should.have.property('code', 'NO_EXECUTORS');
                body.errors[0].should.have.property('title',
                    'No executors available for Playbook "FiFI playbook 5" (63d92aeb-9351-4216-8d7c-044d171337bc)');
            });

            test('exclude RHC is case-insensitive', async function () {
                // do not create db record
                base.getSandbox().stub(queries, 'insertRHCPlaybookRun').returns();

                // force uuid for snapshot test
                base.getSandbox().stub(fifi_2, 'uuidv4').returns('b995e750-c1d3-4c5b-a3ec-eee897ee9065');

                const spy = base.getSandbox().spy(dispatcher, 'postV2PlaybookRunRequests');

                const {body} = await request
                    .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                    .send({exclude: ['rHc']})
                    .set(auth.fifi)
                    .expect(201);

                expect(spy.args).toMatchSnapshot();
            });

            test('post playbook_runs with wrong exclude statement', async function () {
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

            test.skip('post playbook_runs with response_mode: diff', async function () {
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

            test.skip('post playbook_runs with response_mode: full', async function () {
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

            test.skip('post playbook_runs with (default response mode)', async function () {
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

            test.skip('post playbook_runs with response_mode: diff and exclude executors', async function () {
                mockDate();
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

            test.skip('dynamic post playbook_runs with < 200 executors', async function () {
                mockDate();

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

            test.skip('dynamic post playbook_runs with < 400 executors', async function () {
                mockDate();

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

            test.skip('dynamic post playbook_runs with >= 400 executors', async function () {
                mockDate();

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

            test.skip('400 if response_mode is wrong', async function () {
                await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .send({response_mode: 'fifi'})
                .set(auth.fifi)
                .expect(400);
            });

            test.skip('400 if response_mode is wrong with right exclude', async function () {
                await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .send({response_mode: 'something', exclude: ['722ec903-f4b5-4b1f-9c2f-23fc7b0ba390']})
                .set(auth.fifi)
                .expect(400);
            });

            test.skip('400 if exclude is wrong with right response_mode', async function () {
                await request
                .post('/v1/remediations/63d92aeb-9351-4216-8d7c-044d171337bc/playbook_runs')
                .send({response_mode: 'diff', exclude: ['fifi']})
                .set(auth.fifi)
                .expect(400);
            });

            test.skip('if 1st executor result from receptor connector is request error', async function () {
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

            test('cancel playbook when there are Sat-RHC systems running', async () => {
                const spy = base.getSandbox().spy(dispatcher, 'postPlaybookCancelRequest');
                await request
                .post('/v1/remediations/d12efef0-9580-4c82-b604-9888e2269c5a/playbook_runs/88d0ba73-0015-4e7d-a6d6-4b530cbfb7bc/cancel')
                .set(auth.fifi)
                .expect(202);

                spy.callCount.should.equal(1);

                spy.firstCall.args[0].should.eql([{
                    run_id: '88d0ba73-0015-4e7d-a6d6-4b530cbfb7bc',
                    org_id: '6666666',
                    principal: 'fifi'
                }]);
            });

            test('cancel playbook when no executors are still running', async () => {
                const spy = base.getSandbox().spy(receptor, 'postInitialRequest');
                await request
                .post('/v1/remediations/64d92aeb-9351-4216-8d7c-044d171337bd/playbook_runs/7d462faa-0918-44e2-9b36-dbdbb69db463/cancel')
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

    describe.skip('scenario tests', function () {
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
            .set('if-match', '"b48-TyVONjo4V6eLe5E3p90RxLra8So"')
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
            run.executors[1].should.have.property('system_count', 5);
            run.executors[1].should.have.property('updated_at');
            run.executors[1].should.have.property('playbook');

            const {body: systems} = await request
            .get(`/v1/remediations/d12efef0-9580-4c82-b604-9888e2269c5a/playbook_runs/${post.id}/systems`)
            .set(auth.fifi)
            .expect(200);

            systems.should.have.property('meta', {
                count: 8,
                total: 8
            });

            systems.data.should.have.length(8);

            _.forEach(systems.data, system => {
                system.should.have.property('status', 'pending');
                system.should.have.properties('updated_at', 'playbook_run_executor_id');
            });

            systems.data[0].should.have.property('system_id', '355986a3-5f37-40f7-8f36-c3ac928ce190');
            systems.data[0].should.have.property('system_name', '355986a3-5f37-40f7-8f36-c3ac928ce190.example.com');

            systems.data[1].should.have.property('system_id', '35e9b452-e405-499c-9c6e-120010b7b465');
            systems.data[1].should.have.property('system_name', '35e9b452-e405-499c-9c6e-120010b7b465.example.com');

            systems.data[2].should.have.property('system_id', '8728dbf3-6500-44bb-a55c-4909a48673ed');
            systems.data[2].should.have.property('system_name', '8728dbf3-6500-44bb-a55c-4909a48673ed.example.com');

            systems.data[3].should.have.property('system_id', '881256d7-8f99-4073-be6d-67ee42ba9af8');
            systems.data[3].should.have.property('system_name', '881256d7-8f99-4073-be6d-67ee42ba9af8.example.com');

            systems.data[4].should.have.property('system_id', '88d0ba73-0015-4e7d-a6d6-4b530cbfb4ad');
            systems.data[4].should.have.property('system_name', '88d0ba73-0015-4e7d-a6d6-4b530cbfb4ad.example.com');

            systems.data[5].should.have.property('system_id', 'b84f4322-a0b8-4fb9-a8dc-8abb9ee16bc0');
            systems.data[5].should.have.property('system_name', 'b84f4322-a0b8-4fb9-a8dc-8abb9ee16bc0');

            systems.data[6].should.have.property('system_id', 'baaad5ad-1b8e-457e-ad43-39d1aea40d4d');
            systems.data[6].should.have.property('system_name', 'baaad5ad-1b8e-457e-ad43-39d1aea40d4d');

            systems.data[7].should.have.property('system_id', 'e4a0a6ff-0f01-4659-ad9d-44150ade51dd');
            systems.data[7].should.have.property('system_name', 'e4a0a6ff-0f01-4659-ad9d-44150ade51dd');

            await P.map(systems.data, async system => {
                const storedSystem = await getSystem(post.id, system.system_id);
                storedSystem.should.have.property('system_id', system.system_id);
                storedSystem.should.have.property('status', 'pending');
                storedSystem.should.have.property('console', '');
                storedSystem.should.have.properties('system_name', 'updated_at', 'playbook_run_executor_id');
            });
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

            run.should.have.property('status', 'failure');
            run.executors.should.have.length(2);

            run.executors[0].should.have.property('executor_id', '722ec903-f4b5-4b1f-9c2f-23fc7b0ba390');
            run.executors[0].should.have.property('status', 'pending');
            run.executors[0].should.have.property('system_count', 3);

            run.executors[1].should.have.property('executor_id', '63142926-46a5-498b-9614-01f2f66fd40b');
            run.executors[1].should.have.property('status', 'failure');
            run.executors[1].should.have.property('system_count', 5);

            const {body: systems} = await request
            .get(`/v1/remediations/d12efef0-9580-4c82-b604-9888e2269c5a/playbook_runs/${post.id}/systems`)
            .set(auth.fifi)
            .expect(200);

            systems.data.should.have.length(8);
            systems.data[0].should.have.property('status', 'pending');
            systems.data[1].should.have.property('status', 'failure');
            systems.data[2].should.have.property('status', 'failure');
            systems.data[3].should.have.property('status', 'pending');
            systems.data[4].should.have.property('status', 'failure');
            systems.data[5].should.have.property('status', 'pending');
            systems.data[6].should.have.property('status', 'failure');
            systems.data[7].should.have.property('status', 'failure');
        });
    });

    describe('syncDispatcherRunsForPlaybookRuns', function () {
        test('syncDispatcherRunsForPlaybookRuns backfill', async () => {
            const sandbox = base.getSandbox();
            const { v4: uuidv4 } = require('uuid');

            // Use an existing playbook run that has no dispatcher_runs
            const playbookRunId = '88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc';

            // Mock dispatcher API response
            sandbox.stub(dispatcher, 'fetchPlaybookRuns').resolves({
                data: [
                    { id: uuidv4(), status: 'success' },
                    { id: uuidv4(), status: 'pending' }
                ]
            });

            // Call sync function
            const result = await fifi_2.syncDispatcherRunsForPlaybookRuns([playbookRunId]);

            // Verify function returned the synced run
            result.should.have.length(1);
            result[0].should.equal(playbookRunId);

            // Verify database was updated - should have created new dispatcher_runs
            const inserted = await db.dispatcher_runs.findAll({
                where: { remediations_run_id: playbookRunId },
                raw: true
            });

            expect(inserted).toHaveLength(2);
            expect(inserted).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        remediations_run_id: playbookRunId,
                        status: 'success'
                    }),
                    expect.objectContaining({
                        remediations_run_id: playbookRunId,
                        status: 'pending'
                    })
                ])
            );
        });

        test('syncDispatcherRunsForPlaybookRuns status update', async () => {
            const sandbox = base.getSandbox();
            const { v4: uuidv4 } = require('uuid');

            // Use an existing playbook run
            const playbookRunId = '88d0ba73-0015-4e7d-a6d6-4b530cbfb6bc';

            // Create some incomplete dispatcher_runs first
            const dispatcherRunId1 = uuidv4();
            const dispatcherRunId2 = uuidv4();
            
            await db.dispatcher_runs.bulkCreate([
                {
                    dispatcher_run_id: dispatcherRunId1,
                    remediations_run_id: playbookRunId,
                    status: 'pending',
                    created_at: new Date(),
                    updated_at: new Date(),
                    pd_response_code: null
                },
                {
                    dispatcher_run_id: dispatcherRunId2,
                    remediations_run_id: playbookRunId,
                    status: 'running',
                    created_at: new Date(),
                    updated_at: new Date(),
                    pd_response_code: null
                }
            ]);

            // Mock dispatcher API response with updated statuses
            sandbox.stub(dispatcher, 'fetchPlaybookRuns').resolves({
                data: [
                    { id: dispatcherRunId1, status: 'success' },
                    { id: dispatcherRunId2, status: 'success' }
                ]
            });

            // Call sync function
            const result = await fifi_2.syncDispatcherRunsForPlaybookRuns([playbookRunId]);

            // Verify function returned the synced run
            result.should.have.length(1);
            result[0].should.equal(playbookRunId);

            // Verify database was updated - statuses should be updated
            const updated = await db.dispatcher_runs.findAll({
                where: { remediations_run_id: playbookRunId },
                raw: true
            });

            expect(updated).toHaveLength(2);
            updated.forEach(run => {
                expect(run.status).toBe('success');
                expect(run.remediations_run_id).toBe(playbookRunId);
            });
        });

        test('syncDispatcherRunsForPlaybookRuns skip failed', async () => {
            const sandbox = base.getSandbox();
            const { v4: uuidv4 } = require('uuid');

            // Use an existing playbook run
            const playbookRunId = '11f7f24a-346b-405c-8dcc-c953511fb21c';

            // Create dispatcher_runs with one failed status
            await db.dispatcher_runs.bulkCreate([
                {
                    dispatcher_run_id: uuidv4(),
                    remediations_run_id: playbookRunId,
                    status: 'failure',
                    created_at: new Date(),
                    updated_at: new Date(),
                    pd_response_code: null
                },
                {
                    dispatcher_run_id: uuidv4(),
                    remediations_run_id: playbookRunId,
                    status: 'pending',
                    created_at: new Date(),
                    updated_at: new Date(),
                    pd_response_code: null
                }
            ]);

            // Stub dispatcher API (should not be called)
            const dispatcherStub = sandbox.stub(dispatcher, 'fetchPlaybookRuns');

            // Call sync function
            const result = await fifi_2.syncDispatcherRunsForPlaybookRuns([playbookRunId]);

            // Verify function returned empty array (no sync needed)
            result.should.have.length(0);

            // Verify dispatcher API was not called
            dispatcherStub.should.not.have.been.called;
        });
    });
});
