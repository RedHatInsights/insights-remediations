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
    }

    async findSources (ids) {
        const uri = new URI(host);
        uri.path('/api/sources/v1.0/sources');

        uri.query({
            'filter[source_ref][eq][]': ids
        });

        const result = await this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders(false)
        }, false, this.sourcesMetrics);

        assert(result.meta.count <= result.meta.limit);
        const data = _(result.data).keyBy('source_ref').value();

        return _(ids)
        .keyBy()
        .mapValues(id => _.get(data, id, null))
        .value();
    }

    async getEndoints (id) {
        const uri = new URI(host);
        uri.path('/api/sources/v1.0/sources');
        uri.segment(id);
        uri.segment('endpoints');

        const result = await this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders(false)
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

            source.endpoints = await this.getEndoints(source.id);
            return source;
        });

        return sources;
    }

    async ping () {
        await this.findSources('test');
    }
}();
