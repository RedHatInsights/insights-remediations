'use strict';

const _ = require('lodash');
const URI = require('urijs');
const qs = require('qs');
const {host, insecure, auth} = require('../../config').dispatcher;

const Connector = require('../Connector');
const metrics = require('../metrics');

const QSOPTIONS = { encode: false };

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.postRunRequests = metrics.createConnectorMetric(this.getName(), 'postPlaybookRunRequests');
        this.fetchRuns = metrics.createConnectorMetric(this.getName(), 'fetchPlaybookRuns');
        this.fetchRunHosts = metrics.createConnectorMetric(this.getName(), 'fetchPlaybookRunHosts');
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

    async fetchPlaybookRuns (filter = null, fields = null, sort_by = null) {
        const uri = this.buildUri(host, 'playbook-dispatcher', 'v1', 'runs');

        if (filter) {
            uri.addQuery(qs.stringify(filter, QSOPTIONS));
        }

        if (fields) {
            uri.addQuery(qs.stringify(fields, QSOPTIONS));
        }

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

    async fetchPlaybookRunHosts (filter = null, fields = null) {
        const uri = this.buildUri(host, 'playbook-dispatcher', 'v1', 'run_hosts');

        if (filter) {
            uri.addQuery(qs.stringify(filter, QSOPTIONS));
        }

        if (fields) {
            uri.addQuery(qs.stringify(fields, QSOPTIONS));
        }

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

    async ping () {}
}();
