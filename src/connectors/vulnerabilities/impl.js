'use strict';

const _ = require('lodash');
const assert = require('assert');

const Connector = require('../Connector');
const {host, insecure, pageSize} = require('../../config').vulnerabilities;
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
        trace.enter('vulnerabilities_impl.getSystems');
        const _uri = this.buildUri(host, 'vulnerability', 'v1', 'cves', id, 'affected_systems', 'ids');
        _uri.query({limit: String(pageSize)});
        let uri = _uri.toString();

        const inventory_ids = [];

        // get affected systems...
        do {
            // grab a page
            trace.event(`Fetch ${uri}`);
            const batch = await this.doHttp({
                    uri: uri,
                    method: 'GET',
                    json: true,
                    rejectUnauthorized: !insecure,
                    headers: this.getForwardedHeaders()
                },
                false,
                this.systemsMetrics);

            // bail if we got nothing back
            if (!batch) {
                break;
            }

            // extract inventory_ids, filter out nulls and push to list
            const batch_ids = _(batch.data).map('inventory_id').filter(Boolean).value();
            inventory_ids.push(...batch_ids);

            // grab provided uri for next batch
            trace.event(`links: ${JSON.stringify(batch.links)}`);
            uri = batch?.links?.next;

            if (uri) {
                // temporarily record this working for debug
                trace.force = true;
            }
        } while (uri);

        trace.leave();
        return inventory_ids;
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
