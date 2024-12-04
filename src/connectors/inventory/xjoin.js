'use strict';
/*eslint-disable max-len*/

const _ = require('lodash');
const P = require('bluebird');
const assert = require('assert');
const metrics = require('../metrics');
const queries = require('./xjoin.queries');
const { pageSize } = require('../../config').inventory;
const { BATCH_DETAILS_QUERY, INSIGHTS_ID_QUERY, BATCH_PROFILE_QUERY, OWNER_ID_QUERY } = require('./xjoin.queries');

const Connector = require('../Connector');
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

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.xjoinDetailsMetrics = metrics.createConnectorMetric(this.getName(), 'getSystemDetailsBatch');
        this.xjoinSystemProfileMetrics = metrics.createConnectorMetric(this.getName(), 'getSystemProfileBatch');
        this.xjoinInsightsIdMetrics = metrics.createConnectorMetric(this.getName(), 'getSystemsByInsightsId');
        this.xjoinOwnerIdMetrics = metrics.createConnectorMetric(this.getName(), 'getSystemsByOwnerId');
    }

    async getSystemDetailsBatch (req, ids = [], refresh = false, retries = 2) {
        if (ids.length === 0) {
            return {};
        }

        if (ids.length > pageSize) {
            const chunks = _.chunk(ids, pageSize);
            const results = await P.map(chunks, chunk => this.getSystemDetailsBatch(req, chunk, refresh));
            return _.assign({}, ...results);
        }

        let response = null;
        const queryIds = ids.map(identifier => ({id: {eq: identifier}}));

        try {
            response = await queries.runQuery(req, BATCH_DETAILS_QUERY, {
                filter: {OR: queryIds},
                order_by: 'display_name',
                order_how: 'ASC',
                limit: pageSize,
                offset: 0
            }, this.getForwardedHeaders(req), this.xjoinDetailsMetrics);
        } catch (e) {
            if (retries > 0) {
                log.warn({ error: e, ids, retries }, 'Xjoin fetch failed. Retrying');
                return this.getSystemDetailsBatch(req, ids, true, retries - 1);
            }

            throw e;
        }

        const transformed = _(response.data.hosts.data)
        .keyBy('id')
        .mapValues(({id, display_name, canonical_facts, ansible_host, facts}) =>
            ({id, display_name, hostname: canonical_facts.fqdn, ansible_host, facts}))
        .value();

        return validate(transformed);
    }

    async getSystemProfileBatch(req, ids = [], refresh = false, retries = 2) {
        if (ids.length === 0) {
            return {};
        }

        if (ids.length > pageSize) {
            const chunks = _.chunk(ids, pageSize);
            const results = await P.map(chunks, chunk => this.getSystemProfileBatch(req, chunk, refresh));
            return _.assign({}, ...results);
        }

        let response = null;
        const queryIds = ids.map(identifier => ({id: {eq: identifier}}));

        try {
            response = await queries.runQuery(req, BATCH_PROFILE_QUERY, {
                filter: {OR: queryIds},
                order_by: 'display_name',
                order_how: 'ASC',
                limit: pageSize,
                offset: 0
            }, this.getForwardedHeaders(req), this.xjoinSystemProfileMetrics);
        } catch (e) {
            if (retries > 0) {
                log.warn({ error: e, ids, retries }, 'Xjoin fetch failed. Retrying');
                return this.getSystemProfileBatch(req, ids, true, retries - 1);
            }

            throw e;
        }

        const transformed = _(response.data.hosts.data)
        .keyBy('id')
        .mapValues(({id, system_profile_facts}) =>
            ({id, system_profile: system_profile_facts}))
        .value();

        return transformed;
    }

    async getSystemsByInsightsId (id, req) {
        const response = await queries.runQuery(req, INSIGHTS_ID_QUERY, {
            insights_id: id
        }, this.getForwardedHeaders(req), this.xjoinInsightsIdMetrics);

        const transformed = _(response.data.hosts.data)
        .map(({id, display_name, canonical_facts, account, updated, ansible_host}) =>
            ({id, insights_id: canonical_facts.insights_id, display_name, hostname: canonical_facts.fqdn, account, updated, ansible_host}))
        .value();

        transformed.forEach(validateHost);
        return transformed;
    }

    async getSystemsByOwnerId (owner_id, req) {
        const response = await queries.runQuery(req, OWNER_ID_QUERY, {
            owner_id
        }, this.getForwardedHeaders(req), this.xjoinOwnerIdMetrics);

        const transformed = _(response.data.hosts.data)
        .map(({id, display_name, canonical_facts, account, updated, ansible_host}) =>
            ({id, insights_id: canonical_facts.insights_id, display_name, hostname: canonical_facts.fqdn, account, updated, ansible_host}))
        .value();

        transformed.forEach(validateHost);
        return transformed;
    }

    async ping (req) {
        const response = queries.runQuery(req, BATCH_DETAILS_QUERY, {limit: 1}, this.getForwardedHeaders(req));
        assert(Array.isArray(response.data.hosts.data));
    }
}();
