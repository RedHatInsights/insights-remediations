'use strict';

const _ = require('lodash');
const P = require('bluebird');
const URI = require('urijs');
const {host, insecure, revalidationInterval, pageSize} = require('../../config').inventory;
const assert = require('assert');

const Connector = require('../Connector');
const metrics = require('../metrics');

function validateHost (host) {
    assert(_.has(host, 'id'), 'id missing for host');
    assert(_.has(host, 'display_name'), 'display_name missing for host');
    assert(_.has(host, 'hostname'), 'hostname missing for host');
}

function validate (result) {
    _.values(result).forEach(validateHost);
    return result;
}

// TODO: this connector could benefit from better caching strategy
module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.metrics = metrics.createConnectorMetric(this.getName(), 'getSystemDetails');
    }

    async getSystemDetailsBatch (ids = [], refresh = false) {
        if (ids.length === 0) {
            return {};
        }

        ids = _.sortBy(ids);

        if (ids.length > pageSize) {
            const chunks = _.chunk(ids, pageSize);
            const results = await P.map(chunks, chunk => this.getSystemDetailsBatch(chunk, refresh));
            return _.assign({}, ...results);
        }

        const uri = new URI(host);
        uri.path('/r/insights/platform/inventory/api/v1/hosts');

        uri.segment(ids.join());
        uri.addQuery('per_page', String(pageSize));

        const response = await this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders()
        },
        {
            key: `remediations|http-cache|inventory|${ids.join()}`,
            refresh,
            revalidationInterval,
            cacheable: body => body.count > 0 // only cache responses with at least 1 record
        },
        this.metrics);

        const transformed = _(response.results)
        .keyBy('id')
        .mapValues(({id, display_name, fqdn: hostname}) => ({id, display_name, hostname}))
        .value();

        return validate(transformed);
    }

    async getSystemsByInsightsId (id) {
        const uri = new URI(host);
        uri.path('/r/insights/platform/inventory/api/v1/hosts');
        uri.addQuery('per_page', String(pageSize));
        uri.addQuery('insights_id', id);

        const response = await this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders()
        }, false);

        assert(response.total <= pageSize, `results exceed page (${response.total})`);

        const transformed = _(response.results)
        .map(({id, insights_id, display_name, fqdn: hostname, account, updated}) =>
            ({id, insights_id, display_name, hostname, account, updated}))
        .value();

        transformed.forEach(validateHost);
        return transformed;
    }

    async ping () {
        const uri = new URI(host);
        uri.path('/r/insights/platform/inventory/api/v1/hosts');
        uri.addQuery('per_page', String(1));

        const response = await this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders()
        });

        assert(Array.isArray(response.results));
    }
}();

