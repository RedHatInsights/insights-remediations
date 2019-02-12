'use strict';

const _ = require('lodash');
const assert = require('assert');

const Connector = require('../Connector');
const URI = require('urijs');
const {host, insecure} = require('../../config').vulnerabilities;
const metrics = require('../metrics');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.systemsMetrics = metrics.createConnectorMetric(this.getName(), 'getSystems');
    }

    getRule () {
        throw new Error('not implemented');
    }

    async getSystems (id) {
        const uri = new URI(host);
        uri.path('/r/insights/platform/vulnerability/v1/cves/');
        uri.segment(id);
        uri.segment('affected_systems');
        uri.addQuery('page_size', String(10000)); // TODO

        const data = await this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders()
        },
        false,
        this.systemsMetrics);

        if (!data) {
            return [];
        }

        assert(data.meta.total_items < 10000);

        return _.map(data.data, 'id');
    }

    async ping () {
        return true; // TODO
    }
}();
