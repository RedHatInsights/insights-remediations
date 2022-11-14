'use strict';

const _ = require('lodash');
const assert = require('assert');

const Connector = require('../Connector');
const {host, insecure} = require('../../config').vulnerabilities;
const metrics = require('../metrics');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.systemsMetrics = metrics.createConnectorMetric(this.getName(), 'getSystems');
        this.resolutionsMetrics = metrics.createConnectorMetric(this.getName(), 'getResolutions');
    }

    getRule () {
        throw new Error('not implemented');
    }

    async getSystems (id) {
        const uri = this.buildUri(host, 'vulnerability', 'v1', 'cves', id, 'affected_systems');
        uri.addQuery('page_size', String(10000)); // TODO - implement pagination

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

        // We actually have CVEs with more than this many affected systems in
        // prod, so I'm disabling this check.  This code needs to be redesigned
        // a bit.
        // assert(data.meta.total_items < 10001);

        return _.map(data.data, 'id');
    }

    async getResolutions (issue) {
        const uri = this.buildUri(host, 'vulnerability', 'v1', 'playbooks', 'templates', issue);

        const resolutions = await this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders()
        },
        false,
        this.systemsMetrics);

        if (!resolutions) {
            return [];
        }

        return _.map(resolutions.data, resolution =>
            _(resolution)
            .pick(['description', 'play', 'resolution_type', 'resolution_risk', 'version'])
            .defaults({
                resolution_risk: -1,
                version: 'unknown',
                resolution_type: 'fix'
            })
            .value()
        );
    }

    async ping () {
        return true; // TODO
    }
}();
