'use strict';

const _ = require('lodash');
const URI = require('urijs');
const qs = require('qs');
const {host, insecure, auth, pageSize} = require('../../config').dispatcher;

const Connector = require('../Connector');
const metrics = require('../metrics');
const log = require('../../util/log');
const P = require("bluebird");

const QSOPTIONS = { encode: true, indices: false };

function generateQueries (filter, fields) {
    return qs.stringify({
        filter: filter.filter,
        fields: fields.fields
    }, QSOPTIONS);
}

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.postRunRequests = metrics.createConnectorMetric(this.getName(), 'postPlaybookRunRequests');
        this.postV2ConnectionStatus = metrics.createConnectorMetric(this.getName(), 'getConnectionStatus');
        this.postV2RunRequests = metrics.createConnectorMetric(this.getName(), 'postV2PlaybookRunRequests');
        this.postPlaybookCancelRequests = metrics.createConnectorMetric(this.getName(), 'postPlaybookCancelRequests');
        this.fetchRuns = metrics.createConnectorMetric(this.getName(), 'fetchPlaybookRuns');
        this.fetchRunHosts = metrics.createConnectorMetric(this.getName(), 'fetchPlaybookRunHosts');
        this.getRunRecipientStatus = metrics.createConnectorMetric(this.getName(), 'getPlaybookRunRecipientStatus');
    }

    async postPlaybookRunRequests (dispatcherWorkRequest) {
        // chunk this request if necessary...
        if (dispatcherWorkRequest.length > pageSize) {
            const chunks = _.chunk(dispatcherWorkRequest, pageSize);
            const results = await P.map(chunks, chunk => this.postPlaybookRunRequests(chunk));
            return results.flat();
        }

        const uri = new URI(host);
        uri.segment('internal');
        uri.segment('dispatch');

        const options = {
            uri: uri.toString(),
            method: 'POST',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders(),
            body: dispatcherWorkRequest
        };

        // This header should be sent to the playbook dispatcher for each internal request.
        if (auth) {
            options.headers.Authorization = `PSK ${auth}`;
        }

        const result = await this.doHttp (options, false, this.postRunRequests);

        if (_.isEmpty(result)) {
            return null;
        }

        return result;
    }

    // Given a list of inventory ids, returns an array of recipient objects:
    //
    // input:
    //
    //     {
    //         org_id:  tenantOrgId,
    //         hosts: systemIds
    //     };
    //
    //
    // output:
    //
    // [
    //     {
    //         "org_id": "5318290",
    //         "recipient": "d415fc2d-9700-4e30-9621-6a410ccc92d8",
    //         "recipient_type": "satellite",
    //         "sat_id": "bd54e0e9-5310-45be-b107-fd7c96672ce5",
    //         "sat_org_id": "5",
    //         "status": "connected",
    //         "systems": [
    //             "c484f980-ab8d-401b-90e7-aa1d4ccf8c0e",
    //             "d0e03cfb-c2fe-4207-809d-6c203f7811c7"
    //         ]
    //     },
    //     {
    //         "org_id": "5318290",
    //         "recipient": "32af5948-301f-449a-a25b-ff34c83264a2",
    //         "recipient_type": "directConnect",
    //         "sat_id": "",
    //         "sat_org_id": "",
    //         "status": "connected",
    //         "systems": [
    //             "fe30b997-c15a-44a9-89df-c236c3b5c540"
    //         ]
    //     }
    // ]
    //
    //  - one object per satellite_organization (recipient_type == satellite)
    //  - one object for each direct-connect hosts
    //  - one object for hosts with recipient_type == none (e.g. old receptor hosts)?
    async getConnectionStatus (dispatcherConnectionStatusRequest) {
        // chunk this request if necessary...
        if (dispatcherConnectionStatusRequest.hosts.length > pageSize) {
            const hosts = _.chunk(dispatcherConnectionStatusRequest.hosts, pageSize);
            const results = await P.map(hosts, chunk => {
                const req = {
                    org_id: dispatcherConnectionStatusRequest.org_id,
                    hosts
                };

                this.postPlaybookRunRequests(req);
            });
            return results.flat();
        }

        const uri = new URI(host);
        uri.segment('internal');
        uri.segment('v2');
        uri.segment('connection_status');

        const options = {
            uri: uri.toString(),
            method: 'POST',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders(),
            body: dispatcherConnectionStatusRequest
        };

        // This header should be sent to the playbook dispatcher for each internal request.
        if (auth) {
            options.headers.Authorization = `PSK ${auth}`;
        }

        const result = await this.doHttp (options, false, this.postV2ConnectionStatus);

        if (_.isEmpty(result)) {
            return [];
        }

        return result;
    }

    async postV2PlaybookRunRequests (dispatcherV2WorkRequests) {
        // chunk this request if necessary...
        if (dispatcherV2WorkRequests.length > pageSize) {
            const chunks = _.chunk(dispatcherV2WorkRequests, pageSize);
            const results = await P.map(chunks, chunk => this.postPlaybookRunRequests(chunk));
            return results.flat();
        }

        const uri = new URI(host);
        uri.segment('internal');
        uri.segment('v2');
        uri.segment('dispatch');

        const options = {
            uri: uri.toString(),
            method: 'POST',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders(),
            body: dispatcherV2WorkRequests
        };

        // This header should be sent to the playbook dispatcher for each internal request.
        if (auth) {
            options.headers.Authorization = `PSK ${auth}`;
        }

        const result = await this.doHttp (options, false, this.postV2RunRequests);

        if (_.isEmpty(result)) {
            return null;
        }

        return result;
    }

    async fetchPlaybookRuns (filter, fields, sort_by = null) {
        const _uri = this.buildUri(host, 'playbook-dispatcher', 'v1', 'runs');
        _uri.search(generateQueries(filter, fields));

        if (sort_by) {
            _uri.addQuery('sort_by', sort_by);
        }

        let uri = _uri.toString();
        let next = "";
        const results = {
            data: [],
            meta: {}
        };
        const options = {
            method: 'GET',
            json: true,
            headers: this.getForwardedHeaders()
        };

        // get playbook runs...
        do {
            // grab a page
            options.uri = uri;
            const batch = await this.doHttp (options,
                false,
                this.fetchRuns);

            // bail if we got nothing
            if (!batch?.data) {
                break;
            }

            // extract data
            results.data = [...results.data, ...batch.data];

            // check provided uri for next batch
            next = batch?.links?.next;

            if (next) {
                uri = _uri.resource(next).toString();
            }
        } while (next);

        if (_.isEmpty(results.data)) {
            return null;
        }

        results.meta.count = results.data.length;

        return results;
    }

    async fetchPlaybookRunHosts (filter, fields) {
        const _uri = this.buildUri(host, 'playbook-dispatcher', 'v1', 'run_hosts');
        _uri.search(generateQueries(filter, fields));

        let uri = _uri.toString();
        let next = "";
        const results = {
            data: [],
            meta: {}
        };
        const options = {
            method: 'GET',
            json: true,
            headers: this.getForwardedHeaders()
        };

        do {
            // grab a page
            options.uri = uri;
            const batch = await this.doHttp (options,
                false,
                this.fetchRunHosts);

            // bail if we got nothing
            if (!batch?.data) {
                break;
            }

            // extract data
            results.data = [...results.data, ...batch.data];

            // check provided uri for next batch
            next = batch?.links?.next;

            if (next) {
                uri = _uri.resource(next).toString();
            }
        } while (next);

        // return results
        if (_.isEmpty(results.data)) {
            return null;
        }

        results.meta.count = results.data.length;

        return results;
    }

    async postPlaybookCancelRequest (cancelPlaybookRunsRequest) {
        const uri = new URI(host);
        uri.segment('internal');
        uri.segment('v2');
        uri.segment('cancel');

        const options = {
            uri: uri.toString(),
            method: 'POST',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders(),
            body: cancelPlaybookRunsRequest
        };

        // This header should be sent to the playbook dispatcher for each internal request.
        if (auth) {
            options.headers.Authorization = `PSK ${auth}`;
        }

        const result = await this.doHttp (options, false, this.postPlaybookCancelRequests);

        if (_.isEmpty(result.data)) {
            return null;
        }

        return result;
    }

    async getPlaybookRunRecipientStatus (dispatcherStatusRequest) {

        // chunk this request if necessary...
        if (dispatcherStatusRequest.length > pageSize) {
            const chunks = _.chunk(dispatcherStatusRequest, pageSize);
            const results = await P.map(chunks, chunk => this.getPlaybookRunRecipientStatus(chunk));
            return results.flat();
        }

        const uri = new URI(host);
        uri.segment('internal');
        uri.segment('v2');
        uri.segment('recipients');
        uri.segment('status');

        const options = {
            uri: uri.toString(),
            method: 'POST',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders(),
            body: dispatcherStatusRequest
        };

        // This header should be sent to the playbook dispatcher for each internal request.
        if (auth) {
            options.headers.Authorization = `PSK ${auth}`;
        }

        log.info({request: dispatcherStatusRequest}, 'PRE RunRecipientStatus');
        const result = await this.doHttp (options, false, this.getRunRecipientStatus);
        // TODO: ehh, we probably shouldn't be logging this...
        log.info({result: result}, 'POST RunRecipientStatus');

        if (_.isNull(result)) {
            return null;
        }

        const transformed = _(result)
        .keyBy('recipient')
        .mapValues(({recipient, org_id, connected}) =>
            ({recipient, org_id, connected}))
        .value();

        return transformed;
    }

    async ping () {}
}();
