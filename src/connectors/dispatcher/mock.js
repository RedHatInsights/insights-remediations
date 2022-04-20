'use strict';

const _ = require('lodash');
const Connector = require('../Connector');
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
    '88d0ba73-0015-4e7d-a6d6-4b530cbfb5bc': {
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
    },
    '31a70e85-378a-4436-96e9-677cd6fba660': {
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
    }
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
    }
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

    fetchPlaybookRuns (filter = null) {
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
                    data: [run]
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

    fetchPlaybookRunHosts (filter = null) {
        if (filter) {
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

    postPlaybookCancelRequest (request) {
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

    ping () {}
}();
