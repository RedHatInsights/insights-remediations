'use strict';

const _ = require('lodash');
const URI = require('urijs');
const qs = require('qs');
const {host, insecure, auth} = require('../../config').dispatcher;

const Connector = require('../Connector');
const metrics = require('../metrics');
const log = require('../../util/log');

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
        this.postV2RunRequests = metrics.createConnectorMetric(this.getName(), 'postV2PlaybookRunRequests');
        this.postPlaybookCancelRequests = metrics.createConnectorMetric(this.getName(), 'postPlaybookCancelRequests');
        this.fetchRuns = metrics.createConnectorMetric(this.getName(), 'fetchPlaybookRuns');
        this.fetchRunHosts = metrics.createConnectorMetric(this.getName(), 'fetchPlaybookRunHosts');
        this.getRunRecipientStatus = metrics.createConnectorMetric(this.getName(), 'getPlaybookRunRecipientStatus');
    }

    async postPlaybookRunRequests (dispatcherWorkRequest) {
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
            options.headers = {
                Authorization: `PSK ${auth}`
            };
        }

        const result = await this.doHttp (options, false, this.postRunRequests);

        if (_.isEmpty(result)) {
            return null;
        }

        return result;
    }

    async postV2PlaybookRunRequests (dispatcherV2WorkRequest) {
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
            body: dispatcherV2WorkRequest
        };

        // This header should be sent to the playbook dispatcher for each internal request.
        if (auth) {
            options.headers = {
                Authorization: `PSK ${auth}`
            };
        }

        log.info({postDetails: options}, 'V2PlaybookRunRequests POST');
        const result = await this.doHttp (options, false, this.postRunRequests);
        log.info({result: result}, 'V2PlaybookRunRequests results');

        if (_.isEmpty(result)) {
            return null;
        }

        return result;
    }

    async fetchPlaybookRuns (filter, fields, sort_by = null) {
        const uri = this.buildUri(host, 'playbook-dispatcher', 'v1', 'runs');
        uri.search(generateQueries(filter, fields));

        if (sort_by) {
            uri.addQuery('sort_by', sort_by);
        }

        const options = {
            uri: uri.toString(),
            method: 'GET',
            json: true,
            headers: this.getForwardedHeaders()
        };

        const result = await this.doHttp (options, false, this.fetchRuns);

        if (_.isEmpty(result.data)) {
            return null;
        }

        return result;
    }

    async fetchPlaybookRunHosts (filter, fields) {
        const uri = this.buildUri(host, 'playbook-dispatcher', 'v1', 'run_hosts');
        uri.search(generateQueries(filter, fields));

        const options = {
            uri: uri.toString(),
            method: 'GET',
            json: true,
            headers: this.getForwardedHeaders()
        };

        const result = await this.doHttp (options, false, this.fetchRunHosts);

        if (_.isEmpty(result.data)) {
            return null;
        }

        return result;
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
            options.headers = {
                Authorization: `PSK ${auth}`
            };
        }

        const result = await this.doHttp (options, false, this.postPlaybookCancelRequests);

        if (_.isEmpty(result.data)) {
            return null;
        }

        return result;
    }

    async getPlaybookRunRecipientStatus (dispatcherStatusRequest) {
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
            options.headers = {
                Authorization: `PSK ${auth}`
            };
        }

        log.info({request: dispatcherStatusRequest}, 'PRE RunRecipientStatus');
        const result = await this.doHttp (options, false, this.getRunRecipientStatus);
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
