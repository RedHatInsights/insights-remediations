'use strict';

const _ = require('lodash');
const P = require('bluebird');
const {host, insecure, revalidationInterval, pageSize} = require('../../config').inventory;
const assert = require('assert');
const config = require('../../config');

const Connector = require('../Connector');
const metrics = require('../metrics');
const log = require('../../util/log');

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
        this.detailsMetrics = metrics.createConnectorMetric(this.getName(), 'getSystemDetails');
        this.profileMetrics = metrics.createConnectorMetric(this.getName(), 'getSystemProfileBatch');
        this.tagsMetrics = metrics.createConnectorMetric(this.getName(), 'getTagsByIds');
    }

    buildHostsUri () {
        if (config.path.prefix === '/api') {
            return this.buildUri(host, 'inventory', 'v1', 'hosts');
        }

        // TODO: remove once everything is on cloud.redhat.com
        return this.buildUri(host, 'inventory', 'api', 'v1', 'hosts');
    }

    async getSystemDetailsBatch (ids = [], refresh = false, retries = 2) {
        if (ids.length === 0) {
            return {};
        }

        ids = _.sortBy(ids);

        if (ids.length > pageSize) {
            const chunks = _.chunk(ids, pageSize);
            const results = await P.map(chunks, chunk => this.getSystemDetailsBatch(chunk, refresh));
            return _.assign({}, ...results);
        }

        const uri = this.buildHostsUri();
        uri.segment(ids.join());
        uri.addQuery('per_page', String(pageSize));

        let response = null;

        try {
            response = await this.doHttp({
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
            this.detailsMetrics);
        } catch (e) {
            if (retries > 0) {
                log.warn({ error: e, ids, retries }, 'Inventory fetch failed. Retrying');
                return this.getSystemDetailsBatch(ids, true, retries - 1);
            }

            throw e;
        }

        const transformed = _(response.results)
        .keyBy('id')
        .mapValues(({id, display_name, fqdn: hostname, ansible_host, facts}) =>
            ({id, display_name, hostname, ansible_host, facts}))
        .value();

        return validate(transformed);
    }

    async getSystemProfileBatch (ids = [], refresh = false, retries = 2) {
        if (ids.length === 0) {
            return {};
        }

        ids = _.sortBy(ids);

        if (ids.length > pageSize) {
            const chunks = _.chunk(ids, pageSize);
            const results = await P.map(chunks, chunk => this.getSystemProfileBatch(chunk, refresh));
            return _.assign({}, ...results);
        }

        const uri = this.buildHostsUri();
        uri.segment(ids.join());
        uri.segment('system_profile');
        uri.addQuery('per_page', String(pageSize));
        uri.addQuery('fields[system_profile]', 'owner_id');

        let response = null;

        try {
            response = await this.doHttp({
                uri: uri.toString(),
                method: 'GET',
                json: true,
                rejectUnauthorized: !insecure,
                headers: this.getForwardedHeaders()
            },
            {
                key: `remediations|http-cache|inventory|system_profile|${ids.join()}`,
                refresh,
                revalidationInterval,
                cacheable: body => body.count > 0 // only cache responses with at least 1 record
            },
            this.profileMetrics);
        } catch (e) {
            if (retries > 0) {
                log.warn({ error: e, ids, retries }, 'Inventory fetch failed. Retrying');
                return this.getSystemProfileBatch(ids, true, retries - 1);
            }

            throw e;
        }

        const transformed = _(response.results)
        .keyBy('id')
        .value();

        return transformed;
    }

    async getSystemsByInsightsId (id) {
        const uri = this.buildHostsUri();
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
        .map(({id, insights_id, display_name, fqdn: hostname, account, updated, ansible_host}) =>
            ({id, insights_id, display_name, hostname, account, updated, ansible_host}))
        .value();

        transformed.forEach(validateHost);
        return transformed;
    }

    async ping () {
        const uri = this.buildHostsUri();
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
