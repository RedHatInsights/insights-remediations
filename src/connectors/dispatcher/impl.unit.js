'use strict';

const impl = require('./impl');
const base = require('../../test');
const dispatcher = require('./serviceMock');
const { mockRequest } = require('../testUtils');
const request = require('../../util/request');
const errors = require('../../errors');
const Connector = require('../Connector');
const {systems: host_list, mixed_systems} = require('../inventory/impl.unit.data');
const URI = require("urijs");
const _ = require("lodash");

const DISPATCHERWORKREQUEST = [
    {
        recipient: '33a12856-a262-4e1e-b562-c099a735ca76',
        account: 123456,
        url: 'https://cloud.redhat.com/api/remediations/v1/playbook?hosts=33a12856-a262-4e1e-b562-c099a735ca76&localhost',
        labels: {
            'playbook-run': 'ef7a1724-6adc-4370-b88c-bed7cb2d3fd2'
        }
    }, {
        recipient: '74b9182-a262-6d7d-b562-c877a735ca37',
        account: 123456,
        url: 'https://cloud.redhat.com/api/remediations/v1/playbook?hosts=74b9182-a262-6d7d-b562-c877a735ca37&localhost',
        labels: {
            'playbook-run': 'ef7a1724-6adc-4370-b88c-bed7cb2d3fd2'
        }
    }
];

const MOCKCANCELREQUEST = [
    {
        run_id: '88d0ba73-0015-4e7d-a6d6-4b530cbfb7bc',
        org_id: '123456',
        principal: 'test'
    }
];

const DISPATCHSTATUSREQUEST = [
    {
        recipient: 'd415fc2d-9700-4e30-9621-6a410ccc92d8',
        org_id: '123456'
    },
    {
        recipient: '320ba13c-e9fd-48ef-99a2-52c704e8a91f',
        org_id: '123456'
    },
    {
        recipient: 'e84c3178-469c-48a4-8087-9537c09b8b50',
        org_id: '123456'
    }
];

const DISPATCHV2STATUSREUEST = {
    org_id: '123456',
    hosts: [
        'b83f6247-d46a-478a-b395-008b12aa2314',
        '50dc93a9-ca3d-4617-95f9-69e69e7e74a4',
        'c457064a-423c-41ee-9298-9f91aab7e0c4',
        '1f378e77-56a4-4b6d-8570-2e08196030e4'
    ]
};

const LARGE_DIRECT_STATUS_REQ = {
    org_id: '123456',
    hosts: host_list
};

const LARGE_SAT_STATUS_REQ = {
    org_id: '123456',
    hosts: mixed_systems
};

const MOCKFILTER = {filter: {service: 'remediations'}};
const MOCKFIELDS = {fields: {data: ['id']}};

const REQ = {
    headers: {
        'x-rh-identity': 'identity',
        'x-rh-insights-request-id': 'request-id'
    },
    identity: { type: 'test' },
    user: { username: 'test', account_number: 'test' }
};

/* eslint-disable max-len */
describe('dispatcher impl', function () {

    beforeEach(mockRequest);

    describe('postPlaybookRunRequests', function () {
        test('POST run requests', async function () {
            const http = base.getSandbox().stub(request, 'run').resolves({
                statusCode: 207,
                body: [
                    {
                        code: 201,
                        id: '7ef23cc6-729f-4f65-8ce7-6f8185c051e9'
                    }, {
                        code: 201,
                        id: '5907b393-1448-4867-988b-5eed8fc02846'
                    }
                ],
                headers: {}
            });

            const results = await impl.postPlaybookRunRequests(REQ, DISPATCHERWORKREQUEST);
            results.should.have.size(2);

            const result1 = results[0];
            result1.should.have.property('code', 201);
            result1.should.have.property('id', '7ef23cc6-729f-4f65-8ce7-6f8185c051e9');

            const result2 = results[1];
            result2.should.have.property('code', 201);
            result2.should.have.property('id', '5907b393-1448-4867-988b-5eed8fc02846');

            http.callCount.should.equal(1);
            const options = http.args[0][0];
            options.headers.should.have.size(2);
            options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
            options.headers.should.have.property('x-rh-identity', 'identity');
        });

        test('returns null dispatcherWorkRequest is incorrect', async function () {
            base.getSandbox().stub(Connector.prototype, 'doHttp').resolves([]);
            await expect(impl.postPlaybookRunRequests(REQ, DISPATCHERWORKREQUEST)).resolves.toBeNull();
        });

        test('connection error handling dispatcherWorkRequest', async function () {
            base.mockRequestError();
            await expect(impl.postPlaybookRunRequests(REQ, DISPATCHERWORKREQUEST)).rejects.toThrow(errors.DependencyError);
        });

        test('status code handling dispatcherWorkRequest', async function () {
            base.mockRequestStatusCode();
            await expect(impl.postPlaybookRunRequests(REQ, DISPATCHERWORKREQUEST)).rejects.toThrow(errors.DependencyError);
        });

        test('handles many requests', async function () {
            // mock http request
            base.getSandbox().stub(request, 'run').callsFake(params => {
                if (params.body.length > 50) {
                    return Promise.resolve({
                        statusCode: 400,
                        body: {},
                        headers: {}
                    });
                }

                const results = params.body.map((item) => ({
                    code: 201,
                    id: item.recipient
                }));

                return Promise.resolve({
                    statusCode: 207,
                    body: results,
                    headers: {}
                });
            });

            // build array of work requests
            const workRequest = Array(250)
                .fill(0)
                .map((item, index) => {
                    const recipient_id = `33a12856-a262-4e1e-b562-c099a735c${String(index).padStart(3, '0')}}`;
                    return {
                        recipient: recipient_id,
                        account: 123456,
                        url: `https://cloud.redhat.com/api/remediations/v1/playbook?hosts=${recipient_id}&localhost`,
                        labels: {'playbook-run': 'ef7a1724-6adc-4370-b88c-bed7cb2d3fd2'}
                    };
                });

            // submit work request
            const result = await impl.postPlaybookRunRequests(REQ, workRequest);

            // validate results
            result.should.have.size(250);
        });
    });

    describe('getPlaybookRuns', function () {
        test('GET list of runs', async function () {
            const http = base.getSandbox().stub(request, 'run').resolves({
                statusCode: 200,
                body: {
                    meta: {
                        count: 2
                    },
                    data: [
                        {
                            id: '8e015e92-02bd-4df1-80c5-3a00b93c4a4a',
                            account: 654321,
                            recipient: '9574cba7-b9ce-4725-b392-e959afd3e69a',
                            correlation_id: '5c9ae28b-1728-4067-b1f3-f4ad992a8296',
                            url: 'https://cloud.redhat.com/api/remediations/v1/remediations/f376d664-5725-498d-8cf9-bbfaa51b80ca/playbook?hosts=9574cba7-b9ce-4725-b392-e959afd3e69a&localhost',
                            labels: {
                                'playbook-run': 'ef7a1724-6adc-4370-b88c-bed7cb2d3fd2'
                            },
                            status: 'running',
                            service: 'remediations',
                            created_at: 'sometime',
                            updated_at: 'sometime'
                        },
                        {
                            id: '9ce94170-34a0-4aa6-976a-9728aa4da7a4',
                            account: 654321,
                            recipient: '750c60ee-b67e-4ccd-8d7f-cb8aed2bdbf4',
                            correlation_id: '1b4244aa-2572-4067-bf44-ad4e5bfaafc4',
                            url: 'https://cloud.redhat.com/api/remediations/v1/remediations/f376d664-5725-498d-8cf9-bbfaa51b80ca/playbook?hosts=750c60ee-b67e-4ccd-8d7f-cb8aed2bdbf4&localhost',
                            labels: {
                                'playbook-run': 'fe7a1724-6adc-4370-b88c-bed7cb2d3fd4'
                            },
                            status: 'running',
                            service: 'remediations',
                            created_at: 'sometime',
                            updated_at: 'sometime'
                        }
                    ]
                },
                headers: {}
            });

            const results = await impl.fetchPlaybookRuns(REQ, MOCKFILTER, MOCKFIELDS);
            results.data.should.have.size(2);

            const result1 = results.data[0];
            result1.should.have.property('id', '8e015e92-02bd-4df1-80c5-3a00b93c4a4a');
            result1.should.have.property('account', 654321);
            result1.should.have.property('recipient', '9574cba7-b9ce-4725-b392-e959afd3e69a');
            result1.should.have.property('correlation_id', '5c9ae28b-1728-4067-b1f3-f4ad992a8296');
            result1.should.have.property('url', 'https://cloud.redhat.com/api/remediations/v1/remediations/f376d664-5725-498d-8cf9-bbfaa51b80ca/playbook?hosts=9574cba7-b9ce-4725-b392-e959afd3e69a&localhost');
            result1.should.have.property('labels', {'playbook-run': 'ef7a1724-6adc-4370-b88c-bed7cb2d3fd2'});
            result1.should.have.property('status', 'running');
            result1.should.have.property('service', 'remediations');
            result1.should.have.property('created_at', 'sometime');
            result1.should.have.property('updated_at', 'sometime');

            const result2 = results.data[1];
            result2.should.have.property('id', '9ce94170-34a0-4aa6-976a-9728aa4da7a4');
            result2.should.have.property('account', 654321);
            result2.should.have.property('recipient', '750c60ee-b67e-4ccd-8d7f-cb8aed2bdbf4');
            result2.should.have.property('correlation_id', '1b4244aa-2572-4067-bf44-ad4e5bfaafc4');
            result2.should.have.property('url', 'https://cloud.redhat.com/api/remediations/v1/remediations/f376d664-5725-498d-8cf9-bbfaa51b80ca/playbook?hosts=750c60ee-b67e-4ccd-8d7f-cb8aed2bdbf4&localhost');
            result2.should.have.property('labels', {'playbook-run': 'fe7a1724-6adc-4370-b88c-bed7cb2d3fd4'});
            result2.should.have.property('status', 'running');
            result2.should.have.property('service', 'remediations');
            result2.should.have.property('created_at', 'sometime');
            result2.should.have.property('updated_at', 'sometime');

            http.callCount.should.equal(1);
            const options = http.args[0][0];
            options.headers.should.have.size(2);
            options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
            options.headers.should.have.property('x-rh-identity', 'identity');
        });

        // TODO
        test('merges paginated request', async () => {});

        test('returns null dispatcherWorkRequest is incorrect', async function () {
            base.getSandbox().stub(request, 'run').resolves({
                statusCode: 200,
                body: {
                    meta: {
                        count: 0
                    },
                    data: []
                },
                headers: {}
            });

            await expect(impl.fetchPlaybookRuns(REQ, MOCKFILTER, MOCKFIELDS)).resolves.toBeNull();
        });

        test('connection error handling dispatcherWorkRequest', async function () {
            base.mockRequestError();
            await expect(impl.fetchPlaybookRuns(REQ, MOCKFILTER, MOCKFIELDS)).rejects.toThrow(errors.DependencyError);
        });

        test('status code handling dispatcherWorkRequest', async function () {
            base.mockRequestStatusCode();
            await expect(impl.fetchPlaybookRuns(REQ, MOCKFILTER, MOCKFIELDS)).rejects.toThrow(errors.DependencyError);
        });
    });

    describe('getPlaybookRunHosts', function () {
        test('GET list of run hosts', async function () {
            const http = base.getSandbox().stub(request, 'run').resolves({
                statusCode: 200,
                body: {
                    meta: {
                        count: 2
                    },
                    data: [
                        {
                            host: '9574cba7-b9ce-4725-b392-e959afd3e69a',
                            run: {
                                id: '8e015e92-02bd-4df1-80c5-3a00b93c4a4a',
                                account: 654321,
                                recipient: '9574cba7-b9ce-4725-b392-e959afd3e69a',
                                correlation_id: '5c9ae28b-1728-4067-b1f3-f4ad992a8296',
                                url: 'https://cloud.redhat.com/api/remediations/v1/remediations/f376d664-5725-498d-8cf9-bbfaa51b80ca/playbook?hosts=9574cba7-b9ce-4725-b392-e959afd3e69a&localhost',
                                labels: {
                                    'playbook-run': 'ef7a1724-6adc-4370-b88c-bed7cb2d3fd2'
                                },
                                timeout: '2000',
                                status: 'running'
                            },
                            status: 'running',
                            stdout: 'console log goes here',
                            inventory_id: '07adc41a-a6c6-426a-a0d5-c7ba08954153'
                        },
                        {
                            host: '750c60ee-b67e-4ccd-8d7f-cb8aed2bdbf4',
                            run: {
                                id: '9ce94170-34a0-4aa6-976a-9728aa4da7a4',
                                account: 654321,
                                recipient: '750c60ee-b67e-4ccd-8d7f-cb8aed2bdbf4',
                                url: 'https://cloud.redhat.com/api/remediations/v1/remediations/f376d664-5725-498d-8cf9-bbfaa51b80ca/playbook?hosts=750c60ee-b67e-4ccd-8d7f-cb8aed2bdbf4&localhost',
                                labels: {
                                    'playbook-run': 'fe7a1724-6adc-4370-b88c-bed7cb2d3fd4'
                                },
                                timeout: '2000',
                                status: 'running'
                            },
                            status: 'running',
                            stdout: 'console log goes here',
                            inventory_id: '17adc41a-a6c6-426a-a0d5-c7ba08954154'
                        }
                    ]
                },
                headers: {}
            });

            const results = await impl.fetchPlaybookRunHosts(REQ, MOCKFILTER, MOCKFIELDS);
            results.data.should.have.size(2);

            const result1 = results.data[0];
            result1.should.have.property('host', '9574cba7-b9ce-4725-b392-e959afd3e69a');
            result1.should.have.property('status', 'running');
            result1.should.have.property('stdout', 'console log goes here');
            result1.should.have.property('inventory_id', '07adc41a-a6c6-426a-a0d5-c7ba08954153');

            const result2 = results.data[1];
            result2.should.have.property('host', '750c60ee-b67e-4ccd-8d7f-cb8aed2bdbf4');
            result2.should.have.property('status', 'running');
            result2.should.have.property('stdout', 'console log goes here');
            result2.should.have.property('inventory_id', '17adc41a-a6c6-426a-a0d5-c7ba08954154');

            http.callCount.should.equal(1);
            const options = http.args[0][0];
            options.headers.should.have.size(2);
            options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
            options.headers.should.have.property('x-rh-identity', 'identity');
        });

        // TODO
        test('merges paginated request', async () => {});

        test('returns null dispatcherWorkRequest is incorrect', async function () {
            base.getSandbox().stub(Connector.prototype, 'doHttp').resolves([]);
            await expect(impl.fetchPlaybookRunHosts(REQ, MOCKFILTER, MOCKFIELDS)).resolves.toBeNull();
        });

        test('connection error handling dispatcherWorkRequest', async function () {
            base.mockRequestError();
            await expect(impl.fetchPlaybookRunHosts(REQ, MOCKFILTER, MOCKFIELDS)).rejects.toThrow(errors.DependencyError);
        });

        test('status code handling dispatcherWorkRequest', async function () {
            base.mockRequestStatusCode();
            await expect(impl.fetchPlaybookRunHosts(REQ, MOCKFILTER, MOCKFIELDS)).rejects.toThrow(errors.DependencyError);
        });
    });

    describe('postPlaybookCancelRequest', function () {
        test('POST successful cancel request', async function () {
            const http = base.getSandbox().stub(request, 'run').resolves({
                statusCode: 207,
                body: {
                    meta: {
                        count: 1
                    },
                    data: [
                        {
                            run_id: '88d0ba73-0015-4e7d-a6d6-4b530cbfb7bc',
                            code: 202
                        }
                    ]
                },
                headers: {}
            });

            const results = await impl.postPlaybookCancelRequest(REQ, MOCKCANCELREQUEST);
            results.data.should.have.size(1);

            const result1 = results.data[0];
            result1.should.have.property('run_id', '88d0ba73-0015-4e7d-a6d6-4b530cbfb7bc');
            result1.should.have.property('code', 202);

            http.callCount.should.equal(1);
            const options = http.args[0][0];
            options.headers.should.have.size(2);
            options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
            options.headers.should.have.property('x-rh-identity', 'identity');
        });

        test('returns null playbookCancelRequest is incorrect', async function () {
            base.getSandbox().stub(Connector.prototype, 'doHttp').resolves([]);
            await expect(impl.postPlaybookCancelRequest(REQ, MOCKCANCELREQUEST)).resolves.toBeNull();
        });

        test('connection error handling playbookCancelRequest', async function () {
            base.mockRequestError();
            await expect(impl.postPlaybookCancelRequest(REQ, MOCKCANCELREQUEST)).rejects.toThrow(errors.DependencyError);
        });

        test('status code handling playbookCancelRequest', async function () {
            base.mockRequestStatusCode();
            await expect(impl.postPlaybookCancelRequest(REQ, MOCKCANCELREQUEST)).rejects.toThrow(errors.DependencyError);
        });
    });

    describe('getPlaybookRunRecipientStatus', function () {
        test('get run recipient statuses', async function () {
            const http = base.getSandbox().stub(request, 'run').resolves({
                statusCode: 200,
                body: [
                        {
                            recipient: 'd415fc2d-9700-4e30-9621-6a410ccc92d8',
                            org_id: '123456',
                            connected: true
                        },
                        {
                            recipient: '320ba13c-e9fd-48ef-99a2-52c704e8a91f',
                            org_id: '123456',
                            connected: false
                        },
                        {
                            recipient: 'e84c3178-469c-48a4-8087-9537c09b8b50',
                            org_id: '123456',
                            connected: true
                        }
                ],
                headers: {}
            });

            const results = await impl.getPlaybookRunRecipientStatus(REQ, DISPATCHSTATUSREQUEST);

            const result1 = results['d415fc2d-9700-4e30-9621-6a410ccc92d8'];
            result1.should.have.property('recipient', 'd415fc2d-9700-4e30-9621-6a410ccc92d8');
            result1.should.have.property('org_id', '123456');
            result1.should.have.property('connected', true);

            const result2 = results['320ba13c-e9fd-48ef-99a2-52c704e8a91f'];
            result2.should.have.property('recipient', '320ba13c-e9fd-48ef-99a2-52c704e8a91f');
            result2.should.have.property('org_id', '123456');
            result2.should.have.property('connected', false);

            const result3 = results['e84c3178-469c-48a4-8087-9537c09b8b50'];
            result3.should.have.property('recipient', 'e84c3178-469c-48a4-8087-9537c09b8b50');
            result3.should.have.property('org_id', '123456');
            result3.should.have.property('connected', true);

            http.callCount.should.equal(1);
            const options = http.args[0][0];
            options.headers.should.have.size(2);
            options.headers.should.have.property('x-rh-insights-request-id', 'request-id');
            options.headers.should.have.property('x-rh-identity', 'identity');
        });

        test('returns null dispatcherStatusRequest is incorrect', async function () {
            base.getSandbox().stub(Connector.prototype, 'doHttp').resolves(null);
            await expect(impl.getPlaybookRunRecipientStatus(REQ, DISPATCHSTATUSREQUEST)).resolves.toBeNull();
        });

        test('connection error handling dispatcherStatusRequest', async function () {
            base.mockRequestError();
            await expect(impl.getPlaybookRunRecipientStatus(REQ, DISPATCHSTATUSREQUEST)).rejects.toThrow(errors.DependencyError);
        });

        test('status code handling dispatcherStatusRequest', async function () {
            base.mockRequestStatusCode();
            await expect(impl.getPlaybookRunRecipientStatus(REQ, DISPATCHSTATUSREQUEST)).rejects.toThrow(errors.DependencyError);
        });
    });

    describe('getConnectionStatus', () => {
        test('GET system connection statuses', async () => {
            base.getSandbox().stub(request, 'run').resolves({
                statusCode: 200,
                body: [
                    {
                        recipient: 'd415fc2d-9700-4e30-9621-6a410ccc92d8',
                        org_id: '123456',
                        sat_id: "aa3b1faa-56f3-4d14-8258-615d11e20060",
                        sat_org_id: '2',
                        recipient_type: 'satellite',
                        systems: [
                            'b83f6247-d46a-478a-b395-008b12aa2314',
                            '50dc93a9-ca3d-4617-95f9-69e69e7e74a4',
                            'c457064a-423c-41ee-9298-9f91aab7e0c4',
                            '1f378e77-56a4-4b6d-8570-2e08196030e4'
                        ],
                        status: 'connected'
                    }
                ],
                headers: {}
            });

            const results = await impl.getConnectionStatus(REQ, DISPATCHV2STATUSREUEST);

            results.should.have.length(1);
            results[0].systems.should.have.length(4);
        });

        test('chunks large request', async () => {
            // verify correct collation (sat_a: 51+, sat_b: 2+, direct_a: 1, direct_b: 1)
            base.getSandbox().stub(request, 'run').callsFake(dispatcher);
            const results = await impl.getConnectionStatus(REQ, LARGE_SAT_STATUS_REQ);

            expect(results.body).toMatchSnapshot();
        });

        test('returns empty array if no results', async () => {
            base.getSandbox().stub(Connector.prototype, 'doHttp').resolves(null);
            await expect(impl.getConnectionStatus(REQ, DISPATCHV2STATUSREUEST)).resolves.toEqual([]);
        });

        test('connection error handling dispatcherV2StatusRequest', async () => {
            base.mockRequestStatusCode();
            await expect(impl.getConnectionStatus(REQ, DISPATCHV2STATUSREUEST)).rejects.toThrow(errors.DependencyError);
        });

        test('status code handling dispatcherV2StatusRequest', async () => {
            base.mockRequestStatusCode();
            await expect(impl.getConnectionStatus(REQ, DISPATCHV2STATUSREUEST)).rejects.toThrow(errors.DependencyError);
        });
    });
});
