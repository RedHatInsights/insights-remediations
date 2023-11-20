'use strict';

const _ = require('lodash');
const P = require('bluebird');
const URI = require('urijs');
const assert = require('assert');
const Connector = require('../Connector');

const {host, insecure} = require('../../config').sources;

const metrics = require('../metrics');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.sourcesMetrics = metrics.createConnectorMetric(this.getName(), 'getSources');
        this.endpointMetrics = metrics.createConnectorMetric(this.getName(), 'getEndpoints');
        this.rhcConnectionsMetrics = metrics.createConnectorMetric(this.getName(), 'getRHCConnections');
    }

    async findSources (ids) {
        // TODO: Chunk this is list of ids is long

        if (ids.length === 0) {
            return {};
        }

        const uri = new URI(host);
        uri.path('/api/sources/v2.0/sources');

        uri.query({
            'filter[source_ref][eq][]': ids
        });

        const result = await this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders()
        }, false, this.sourcesMetrics);

        assert(result.meta.count <= result.meta.limit);
        const data = _(result.data).keyBy('source_ref').value();

        return _(ids)
        .keyBy()
        .mapValues(id => _.get(data, id, null))
        .value();
    }

    async getEndpoints (id) {
        const uri = this.buildUri(host, 'sources', 'v2.0', 'sources', String(id), 'endpoints');

        const result = await this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders()
        }, false, this.endpointMetrics);

        if (!result) {
            return null;
        }

        assert(result.meta.count <= result.meta.limit);
        return result.data;
    }

    async getSourceInfo (ids) {
        const sources = await this.findSources(ids);

        await P.map(_.values(sources), async source => {
            if (source === null) {
                return source;
            }

            source.endpoints = await this.getEndpoints(source.id);
            return source;
        });

        return sources;
    }

    async getRHCConnections (id) {
        const uri = this.buildUri(host, 'sources', 'v3.1', 'sources', String(id), 'rhc_connections');

        const result = await this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders()
        }, false, this.rhcConnectionsMetrics);

        if (!result) {
            return null;
        }

        assert(result.meta.count <= result.meta.limit);
        return result.data;
    }

    async ping () {
        await this.findSources('test');
    }
}();
