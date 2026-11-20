'use strict';

const fs = require('fs');
const _ = require('lodash');
const P = require('bluebird');
const URI = require('urijs');
const assert = require('assert');
const Connector = require('../Connector');
const StatusCodeError = require('../StatusCodeError');

const {host, insecure, authenticated, caCert: caCertPath} = require('../../config').sources;
const { getV2BearerToken, applyV2CaCert } = require('../../util/v2Auth');

const metrics = require('../metrics');

// Read V2 CA cert once at module load
const caCertBuffer = caCertPath // eslint-disable-line security/detect-non-literal-fs-filename
    ? fs.readFileSync(caCertPath) : null;

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.sourcesMetrics = metrics.createConnectorMetric(this.getName(), 'getSources');
        this.endpointMetrics = metrics.createConnectorMetric(this.getName(), 'getEndpoints');
        this.rhcConnectionsMetrics = metrics.createConnectorMetric(this.getName(), 'getRHCConnections');
    }

    /**
     * Build request options with V2 bearer auth and CA cert at the shared boundary.
     * @param {object} baseOptions - Base request-promise options.
     * @returns {Promise<object>} Enhanced options with V2 auth and TLS.
     */
    async buildV2RequestOptions (baseOptions) {
        const headers = { ...baseOptions.headers };

        // V2 authenticated endpoint: attach bearer for cross-cluster gateway auth
        if (authenticated) {
            const token = await getV2BearerToken();
            headers.Authorization = `Bearer ${token}`;
        }

        return applyV2CaCert({ ...baseOptions, headers }, caCertBuffer);
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

        const options = await this.buildV2RequestOptions({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders()
        });

        const result = await this.doHttp(options, false, this.sourcesMetrics);

        assert(result.meta.count <= result.meta.limit);
        const data = _(result.data).keyBy('source_ref').value();

        return _(ids)
        .keyBy()
        .mapValues(id => _.get(data, id, null))
        .value();
    }

    async getEndpoints (id) {
        const uri = this.buildUri(host, 'sources', 'v2.0', 'sources', String(id), 'endpoints');

        const options = await this.buildV2RequestOptions({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders()
        });

        let result;
        try {
            result = await this.doHttp(options, false, this.endpointMetrics);
        } catch (e) {
            if (e instanceof StatusCodeError && e.statusCode === 404) {
                return null;
            }

            throw e;
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

        const options = await this.buildV2RequestOptions({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders()
        });

        let result;
        try {
            result = await this.doHttp(options, false, this.rhcConnectionsMetrics);
        } catch (e) {
            if (e instanceof StatusCodeError && e.statusCode === 404) {
                return null;
            }

            throw e;
        }

        assert(result.meta.count <= result.meta.limit);
        return result.data;
    }

    async ping () {
        await this.findSources('test');
    }
}();
