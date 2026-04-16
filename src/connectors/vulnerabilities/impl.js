'use strict';

const _ = require('lodash');
const assert = require('assert');

const Connector = require('../Connector');
const StatusCodeError = require('../StatusCodeError');
const {host, insecure, pageSize} = require('../../config').vulnerabilities;
const metrics = require('../metrics');
const getTrace = require('../../util/trace');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.systemsMetrics = metrics.createConnectorMetric(this.getName(), 'getSystems');
        this.resolutionsMetrics = metrics.createConnectorMetric(this.getName(), 'getResolutions');
    }

    getRule () {
        throw new Error('not implemented');
    }

    async getSystems (req, id) {
        getTrace(req).enter('vulnerabilities_impl.getSystems');
        const _uri = this.buildUri(host, 'vulnerability', 'v1', 'cves', id, 'affected_systems', 'ids');
        _uri.query({limit: String(pageSize)});

        let uri = _uri.toString();
        let next = "";

        const inventory_ids = [];

        // get affected systems...
        do {
            // grab a page
            getTrace(req).event(`Fetch ${uri}`);
            let batch;
            try {
                batch = await this.doHttp({
                        uri: uri,
                        method: 'GET',
                        json: true,
                        rejectUnauthorized: !insecure,
                        headers: this.getForwardedHeaders(req)
                    },
                    false,
                    this.systemsMetrics,
                    undefined,
                    req);
            } catch (e) {
                if (e instanceof StatusCodeError && e.statusCode === 404) {
                    break;
                }
                throw e;
            }

            // bail if we got nothing back
            if (!batch) {
                break;
            }

            // extract inventory_ids, filter out nulls and push to list
            const batch_ids = _(batch.data).map('inventory_id').filter(Boolean).value();
            inventory_ids.push(...batch_ids);

            // grab provided uri for next batch
            next = batch?.links?.next;

            if (next) {
                uri = _uri.resource(next).toString();
            }
        } while (next);

        getTrace(req).leave();
        return inventory_ids;
    }

    async getResolutions (req, issue) {
        getTrace(req).enter('connectors/vulnerabilities/impl.getResolutions');

        const uri = this.buildUri(host, 'vulnerability', 'v1', 'playbooks', 'templates', issue);

        const options = {
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders(req)
        };

        getTrace(req).event(`GET options: ${JSON.stringify(options)}`);

        let resolutions;
        try {
            resolutions = await this.doHttp(
                options,
                false,
                this.systemsMetrics,
                undefined,
                req);
        } catch (e) {
            if (e instanceof StatusCodeError && e.statusCode === 404) {
                getTrace(req).leave('No resolutions found (404)!');
                return [];
            }
            throw e;
        }

        if (!resolutions) {
            getTrace(req).leave('No resolutions found!');
            return [];
        }

        getTrace(req).event(`Got data back!`);

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

        getTrace(req).leave(`Returning results`);
        return result;
    }

    async ping () {
        return true; // TODO
    }
}();
