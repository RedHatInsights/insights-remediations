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

    async postV2PlaybookRunRequests (dispatcherV2WorkRequest) {
        // TODO: chunk if we have more that 50 satellites
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
        const data = [];
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
            data.push(...batch.data);

            // check provided uri for next batch
            next = batch?.links?.next;

            if (next) {
                uri = _uri.resource(next).toString();
            }
        } while (next);

        // return the data
        // TODO: just return array of playbook runs
        return _.isEmpty(data) ? null : {data: data};
    }

    async fetchPlaybookRunHosts (filter, fields) {
        const _uri = this.buildUri(host, 'playbook-dispatcher', 'v1', 'run_hosts');
        _uri.search(generateQueries(filter, fields));

        let uri = _uri.toString();
        let next = "";
        const data = [];
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
            data.push(...batch.data);

            // check provided uri for next batch
            next = batch?.links?.next;

            if (next) {
                uri = _uri.resource(next).toString();
            }
        } while (next);

        // TODO: just return array of playbook run hosts
        if (_.isEmpty(data)) {
            return null;
        }

        return {data: data};
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
        // TODO: chunk this
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
