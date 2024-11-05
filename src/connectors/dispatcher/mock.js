'use strict';

const _ = require('lodash');
const Connector = require('../Connector');
const generator = require('../inventory/systemGenerator');

/* eslint-disable max-len */

const MOCKDISPATCHRESPONSE = [
    {
        code: 200,
        id: '7ef23cc6-729f-4f65-8ce7-6f8185c051e9'
    }, {
        code: 200,
        id: '5907b393-1448-4867-988b-5eed8fc02846'
    }
];

const RUNS = {
    '88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc': [{
        id: '8e015e92-02bd-4df1-80c5-3a00b93c4a4a',
        account: 654321,
        recipient: '9574cba7-b9ce-4725-b392-e959afd3e69a',
        correlation_id: '5c9ae28b-1728-4067-b1f3-f4ad992a8296',
        url: 'https://console.redhat.com/api/remediations/v1/remediations/f376d664-5725-498d-8cf9-bbfaa51b80ca/playbook?hosts=9574cba7-b9ce-4725-b392-e959afd3e69a&localhost',
        labels: {
            'playbook-run': '88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc'
        },
        status: 'running',
        service: 'remediations',
        created_at: '2018-10-04T08:19:36.641Z',
        updated_at: '2018-10-04T08:19:36.641Z'
    }],
    '31a70e85-378a-4436-96e9-677cd6fba660': [{
        id: '9ce94170-34a0-4aa6-976a-9728aa4da7a4',
        account: 654321,
        recipient: '750c60ee-b67e-4ccd-8d7f-cb8aed2bdbf4',
        correlation_id: '1b4244aa-2572-4067-bf44-ad4e5bfaafc4',
        url: 'https://console.redhat.com/api/remediations/v1/remediations/f376d664-5725-498d-8cf9-bbfaa51b80ca/playbook?hosts=750c60ee-b67e-4ccd-8d7f-cb8aed2bdbf4&localhost',
        labels: {
            'playbook-run': '31a70e85-378a-4436-96e9-677cd6fba660'
        },
        status: 'running',
        service: 'remediations',
        created_at: '2018-10-04T08:19:36.641Z',
        updated_at: '2018-10-04T08:19:36.641Z'
    }],
    '8ff5717a-cce8-4738-907b-a89eaa559275': [
        {
            id: '14cdbad8-94e7-44ba-bff3-ba365bc3184a',
            recipient: 'beefface-cce7-4d2c-b45c-97408158fa44',
            url: 'https://console.redhat.com/api/remediations/v1/remediations/efe9fd2b-fdbd-4c74-93e7-8c69f1b668f3/playbook?hosts=c8aea8e7-cce7-4d2c-b45c-97408158fa44&localhost',
            labels: {
                'playbook-run': '8ff5717a-cce8-4738-907b-a89eaa559275'
            },
            status: 'running',
            service: 'remediations',
            created_at: '2024-09-10T22:00:01.000Z',
            updated_at: '2024-09-10T22:00:01.000Z'
        },
        {
            id: '01874201-6eac-4ebb-a2cb-6600884fd441',
            recipient: 'beefface-d43a-4d45-88da-ede32b9787e5',
            url: 'https://console.redhat.com/api/remediations/v1/remediations/efe9fd2b-fdbd-4c74-93e7-8c69f1b668f3/playbook?hosts=bd0f6a65-d43a-4d45-88da-ede32b9787e5&localhost',
            labels: {
                'playbook-run': '8ff5717a-cce8-4738-907b-a89eaa559275'
            },
            status: 'success',
            service: 'remediations',
            created_at: '2024-09-10T22:00:02.000Z',
            updated_at: '2024-09-10T22:00:02.000Z'
        },
        {
            id: 'c9ad6622-c524-42fb-90c5-8be9845193ae',
            recipient: 'beefface-8ed1-4c3c-acd9-f540806829fd',
            url: 'https://console.redhat.com/api/remediations/v1/remediations/efe9fd2b-fdbd-4c74-93e7-8c69f1b668f3/playbook?hosts=c5249a49-8ed1-4c3c-acd9-f540806829fd&localhost',
            labels: {
                'playbook-run': '8ff5717a-cce8-4738-907b-a89eaa559275'
            },
            status: 'failure',
            service: 'remediations',
            created_at: '2024-09-10T22:00:03.000Z',
            updated_at: '2024-09-10T22:00:03.000Z'
        },
        {
            id: 'b286e987-33d7-4d2c-bfe4-b09f5f03e5b7',
            recipient: 'beefface-c2dc-4bc3-b93c-1bace78b9d3a',
            url: 'https://console.redhat.com/api/remediations/v1/remediations/efe9fd2b-fdbd-4c74-93e7-8c69f1b668f3/playbook?hosts=41202783-c2dc-4bc3-b93c-1bace78b9d3a&localhost',
            labels: {
                'playbook-run': '8ff5717a-cce8-4738-907b-a89eaa559275'
            },
            status: 'timeout',
            service: 'remediations',
            created_at: '2024-09-10T22:00:04.000Z',
            updated_at: '2024-09-10T22:00:04.000Z'
        },
        {
            id: 'a8a0ce2a-952e-4b3a-a3de-613382d65831',
            recipient: 'beefface-e0b4-4ed2-9364-10cc9824e755',
            url: 'https://console.redhat.com/api/remediations/v1/remediations/efe9fd2b-fdbd-4c74-93e7-8c69f1b668f3/playbook?hosts=1a87d019-e0b4-4ed2-9364-10cc9824e755&localhost',
            labels: {
                'playbook-run': '8ff5717a-cce8-4738-907b-a89eaa559275'
            },
            status: 'canceled',
            service: 'remediations',
            created_at: '2024-09-10T22:00:05.000Z',
            updated_at: '2024-09-10T22:00:05.000Z'
        },
        {
            id: '8c1b69b4-2c03-4b16-94d9-a577e30711bd',
            recipient: 'beefface-0fa8-4967-9c2a-fae9da4411fa',
            url: 'https://console.redhat.com/api/remediations/v1/remediations/efe9fd2b-fdbd-4c74-93e7-8c69f1b668f3/playbook?hosts=c751a80e-0fa8-4967-9c2a-fae9da4411fa&localhost',
            labels: {
                'playbook-run': '8ff5717a-cce8-4738-907b-a89eaa559275'
            },
            status: 'timeout',
            service: 'remediations',
            created_at: '2024-09-10T22:00:06.000Z',
            updated_at: '2024-09-10T22:00:06.000Z'
        },
        {
            id: '43e6eba3-6cb4-40cc-990c-3cf135e79c08',
            recipient: 'beefface-249c-490b-922f-120689059927',
            url: 'https://console.redhat.com/api/remediations/v1/remediations/efe9fd2b-fdbd-4c74-93e7-8c69f1b668f3/playbook?hosts=f1f6dbe3-249c-490b-922f-120689059927&localhost',
            labels: {
                'playbook-run': '8ff5717a-cce8-4738-907b-a89eaa559275'
            },
            status: 'success',
            service: 'remediations',
            created_at: '2024-09-10T22:00:07.000Z',
            updated_at: '2024-09-10T22:00:07.000Z'
        },
        {
            id: '25adf6f2-d282-4182-bdb4-7af41f1f6dd7',
            recipient: 'beefface-d57e-4e51-8177-7fcd1e70415b',
            url: 'https://console.redhat.com/api/remediations/v1/remediations/efe9fd2b-fdbd-4c74-93e7-8c69f1b668f3/playbook?hosts=720e5c42-d57e-4e51-8177-7fcd1e70415b&localhost',
            labels: {
                'playbook-run': '8ff5717a-cce8-4738-907b-a89eaa559275'
            },
            status: 'running',
            service: 'remediations',
            created_at: '2024-09-10T22:00:08.000Z',
            updated_at: '2024-09-10T22:00:08.000Z'
        },
        {
            id: '501213e4-2507-4ccb-81f7-d9778f71a0a1',
            recipient: 'beefface-5e47-42d5-bbde-46d8d75cadfd',
            url: 'https://console.redhat.com/api/remediations/v1/remediations/efe9fd2b-fdbd-4c74-93e7-8c69f1b668f3/playbook?hosts=39735eef-5e47-42d5-bbde-46d8d75cadfd&localhost',
            labels: {
                'playbook-run': '8ff5717a-cce8-4738-907b-a89eaa559275'
            },
            status: 'canceled',
            service: 'remediations',
            created_at: '2024-09-10T22:00:09.000Z',
            updated_at: '2024-09-10T22:00:09.000Z'
        },
        {
            id: '2802bace-7df3-47af-a7e5-b14dd5690d3c',
            recipient: 'beefface-ec74-49c4-80d4-c9d99b69e6b0',
            url: 'https://console.redhat.com/api/remediations/v1/remediations/efe9fd2b-fdbd-4c74-93e7-8c69f1b668f3/playbook?hosts=4ee9151c-ec74-49c4-80d4-c9d99b69e6b0&localhost',
            labels: {
                'playbook-run': '8ff5717a-cce8-4738-907b-a89eaa559275'
            },
            status: 'failure',
            service: 'remediations',
            created_at: '2024-09-10T22:00:10.000Z',
            updated_at: '2024-09-10T22:00:10.000Z'
        }
    ]
};

const RUNHOSTS = {
    '8e015e92-02bd-4df1-80c5-3a00b93c4a4a': {
        host: 'localhost',
        run: {
            id: '8e015e92-02bd-4df1-80c5-3a00b93c4a4a',
            account: 654321,
            recipient: '9574cba7-b9ce-4725-b392-e959afd3e69a',
            correlation_id: '5c9ae28b-1728-4067-b1f3-f4ad992a8296',
            url: 'https://console.redhat.com/api/remediations/v1/remediations/f376d664-5725-498d-8cf9-bbfaa51b80ca/playbook?hosts=9574cba7-b9ce-4725-b392-e959afd3e69a&localhost',
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
    '9ce94170-34a0-4aa6-976a-9728aa4da7a4': {
        host: 'localhost',
        run: {
            id: '9ce94170-34a0-4aa6-976a-9728aa4da7a4',
            account: 654321,
            recipient: '750c60ee-b67e-4ccd-8d7f-cb8aed2bdbf4',
            url: 'https://console.redhat.com/api/remediations/v1/remediations/f376d664-5725-498d-8cf9-bbfaa51b80ca/playbook?hosts=750c60ee-b67e-4ccd-8d7f-cb8aed2bdbf4&localhost',
            labels: {
                'playbook-run': 'fe7a1724-6adc-4370-b88c-bed7cb2d3fd4'
            },
            timeout: '2000',
            status: 'running'
        },
        status: 'running',
        stdout: 'console log goes here',
        inventory_id: '17adc41a-a6c6-426a-a0d5-c7ba08954154'
    },
    '14cdbad8-94e7-44ba-bff3-ba365bc3184a': {
        host: 'localhost',
        inventory_id: 'c8aea8e7-cce7-4d2c-b45c-97408158fa44',
        run: {
            id: '14cdbad8-94e7-44ba-bff3-ba365bc3184a'
        },
        status: 'running'
    },
    '01874201-6eac-4ebb-a2cb-6600884fd441': {
        host: 'localhost',
        inventory_id: 'bd0f6a65-d43a-4d45-88da-ede32b9787e5',
        run: {
            id: '01874201-6eac-4ebb-a2cb-6600884fd441'
        },
        status: 'success'
    },
    'c9ad6622-c524-42fb-90c5-8be9845193ae': {
        host: 'localhost',
        inventory_id: 'c5249a49-8ed1-4c3c-acd9-f540806829fd',
        run: {
            id: 'c9ad6622-c524-42fb-90c5-8be9845193ae'
        },
        status: 'failure'
    },
    'b286e987-33d7-4d2c-bfe4-b09f5f03e5b7': {
        host: 'localhost',
        inventory_id: '41202783-c2dc-4bc3-b93c-1bace78b9d3a',
        run: {
            id: 'b286e987-33d7-4d2c-bfe4-b09f5f03e5b7'
        },
        status: 'timeout'
    },
    'a8a0ce2a-952e-4b3a-a3de-613382d65831': {
        host: 'localhost',
        inventory_id: '1a87d019-e0b4-4ed2-9364-10cc9824e755',
        run: {
            id: 'a8a0ce2a-952e-4b3a-a3de-613382d65831'
        },
        status: 'canceled'
    },
    '8c1b69b4-2c03-4b16-94d9-a577e30711bd': {
        host: 'localhost',
        inventory_id: 'c751a80e-0fa8-4967-9c2a-fae9da4411fa',
        run: {
            id: '8c1b69b4-2c03-4b16-94d9-a577e30711bd'
        },
        status: 'timeout'
    },
    '43e6eba3-6cb4-40cc-990c-3cf135e79c08': {
        host: 'localhost',
        inventory_id: 'f1f6dbe3-249c-490b-922f-120689059927',
        run: {
            id: '43e6eba3-6cb4-40cc-990c-3cf135e79c08'
        },
        status: 'success'
    },
    '25adf6f2-d282-4182-bdb4-7af41f1f6dd7': {
        host: 'localhost',
        inventory_id: '720e5c42-d57e-4e51-8177-7fcd1e70415b',
        run: {
            id: '25adf6f2-d282-4182-bdb4-7af41f1f6dd7'
        },
        status: 'running'
    },
    '501213e4-2507-4ccb-81f7-d9778f71a0a1': {
        host: 'localhost',
        inventory_id: '39735eef-5e47-42d5-bbde-46d8d75cadfd',
        run: {
            id: '501213e4-2507-4ccb-81f7-d9778f71a0a1'
        },
        status: 'canceled'
    },
    '2802bace-7df3-47af-a7e5-b14dd5690d3c': {
        host: 'localhost',
        inventory_id: '4ee9151c-ec74-49c4-80d4-c9d99b69e6b0',
        run: {
            id: '2802bace-7df3-47af-a7e5-b14dd5690d3c'
        },
        status: 'failure'
    },
};

const CANCELED = {
    '88d0ba73-0015-4e7d-a6d6-4b530cbfb7bc': {
        run_id: '88d0ba73-0015-4e7d-a6d6-4b530cbfb7bc',
        code: 202
    }
};

const RUNSTATUSES = {
    'd415fc2d-9700-4e30-9621-6a410ccc92d8': {
        recipient: 'd415fc2d-9700-4e30-9621-6a410ccc92d8',
        org_id: '123456',
        connected: true
    },
    'f415fc2d-9700-4e30-9621-6a410ccc92c8': {
        recipient: 'f415fc2d-9700-4e30-9621-6a410ccc92c8',
        org_id: '123456',
        connected: true
    }
};

const SAT_RHC_IDS = {};


module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    postPlaybookRunRequests () {
        return MOCKDISPATCHRESPONSE;
    }

    postV2PlaybookRunRequests () {
        return MOCKDISPATCHRESPONSE;
    }

    fetchPlaybookRuns (req, filter = null) {
        if (filter) {
            if (!_.isUndefined(filter.filter.labels)) {
                const run = RUNS[filter.filter.labels['playbook-run']];

                if (_.isUndefined(run)) {
                    return null;
                }

                return {
                    meta: {
                        count: 1
                    },
                    data: run
                };
            }
        }

        return {
            meta: {
                count: 2
            },
            data: _.flatMap(RUNS)
        };
    }

    fetchPlaybookRunHosts (req, filter = null) {
        if (filter) {
            if (!_.isUndefined(filter.filter.inventory_id)) {
                return {
                    meta: {
                        count: 1
                    },
                    data: [_.find(RUNHOSTS, {inventory_id: filter.filter.inventory_id})]
                };
            }

            if (!_.isUndefined(filter.filter.run.id)) {
                return {
                    meta: {
                        count: 1
                    },
                    data: [RUNHOSTS[filter.filter.run.id]]
                };
            }
        }

        return {
            meta: {
                count: 2
            },
            data: _.flatMap(RUNHOSTS)
        };
    }

    postPlaybookCancelRequest (req, request) {
        if (request[0].run_id !== '88d0ba73-0015-4e7d-a6d6-4b530cbfb7bc') {
            return {
                meta: {
                    count: 1
                },
                data: [
                    {
                        run_id: request[0].run_id,
                        code: 404
                    }
                ]
            };
        }

        return {
            meta: {
                count: 1
            },
            data: [CANCELED[request[0].run_id]]
        };
    }

    getPlaybookRunRecipientStatus () {
        return RUNSTATUSES;
    }

    getConnectionStatus (req, dispatcherConnectionStatusRequest) {
        const hosts = dispatcherConnectionStatusRequest.hosts;

        // get system data
        const systems = hosts.map(host => generator.generateSystemInfo(host));

        // 'satellite' -> extract sat systems, grouped by satId+satOrg
        const satellite = _(systems)
            .filter('satelliteId')
            .groupBy(system => `${system.satelliteId}+${system.satelliteOrgId}`)
            .map(hosts => ({
                org_id: dispatcherConnectionStatusRequest.org_id,
                recipient: hosts[0].satelliteId === generator.DISCONNECTED_SATELLITE ?
                    null : (
                        SAT_RHC_IDS[hosts[0].satelliteId] ??
                            (SAT_RHC_IDS[hosts[0].satelliteId] = 'beefface' + hosts[0].satelliteId.slice(8))
                    ),
                recipient_type: 'satellite',
                sat_id: hosts[0].satelliteId,
                sat_org_id: hosts[0].satelliteOrgId,
                status: hosts[0].satelliteId === generator.DISCONNECTED_SATELLITE ? 'disconnected' : 'connected',
                systems: _(hosts).map('id').value()
            }))
            .value();

        // 'directConnect' -> one per host
        const direct = _(systems)
            .filter('rhc_client')
            .map(host => ({
                org_id: dispatcherConnectionStatusRequest.org_id,
                recipient: host.id,
                recipient_type: 'directConnect',
                sat_id: '',
                sat_org_id: '',
                status: host.id.startsWith('deadfeed') ? 'disconnected' : 'connected',
                systems: [host.id]
            }))
            .value();

        // 'none'
        const none = _(systems)
            .filter(system => (_.isEmpty(system.satelliteId) && _.isEmpty(system.rhc_client)))
            .map(host => ({
                org_id: dispatcherConnectionStatusRequest.org_id,
                recipient: '',
                recipient_type: 'none',
                sat_id: '',
                sat_org_id: '',
                status: 'rhc_not_configured',
                systems: [host.id]
            }))
            .value();

        const result = [...satellite, ...direct, ...none];

        return result;
    }

    ping () {}
}();
