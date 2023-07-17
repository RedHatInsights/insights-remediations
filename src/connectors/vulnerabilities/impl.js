'use strict';

const _ = require('lodash');
const assert = require('assert');

const Connector = require('../Connector');
const {host, insecure} = require('../../config').vulnerabilities;
const metrics = require('../metrics');
const trace = require('../../util/trace');

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
        trace.enter('connectors/vulnerabilities/impl.getResolutions');

        const uri = this.buildUri(host, 'vulnerability', 'v1', 'playbooks', 'templates', issue);

        const options = {
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders()
        };

        trace.event(`GET options: ${JSON.stringify(options)}`);

        const resolutions = await this.doHttp(
        options,
        false,
        this.systemsMetrics);

        if (!resolutions) {
            trace.leave('No resolutions found!');
            return [];
        }

        trace.event(`Got data back!`);

        const result =  _.map(resolutions.data, resolution =>
            _(resolution)
            .pick(['description', 'play', 'resolution_type', 'resolution_risk', 'version'])
            .defaults({
                resolution_risk: -1,
                version: 'unknown',
                resolution_type: 'fix'
            })
            .value()
        );

        trace.leave(`Returning results`);
        return result;
    }

    async ping () {
        return true; // TODO
    }
}();
