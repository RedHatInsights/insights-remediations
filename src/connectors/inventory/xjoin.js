'use strict';
/*eslint-disable max-len*/

const _ = require('lodash');
const P = require('bluebird');
const assert = require('assert');
const metrics = require('../metrics');
const queries = require('./xjoin.queries');
const { pageSize } = require('../../config').inventory;
const { BATCH_DETAILS_QUERY, INSIGHTS_ID_QUERY} = require('./xjoin.queries');

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
        this.xjoinInsightsIdMetrics = metrics.createConnectorMetric(this.getName(), 'getSystemsByInsightsId');
    }

    async getSystemDetailsBatch (ids = [], refresh = false, retries = 2) {
        if (ids.length === 0) {
            return {};
        }

        if (ids.length > pageSize) {
            const chunks = _.chunk(ids, pageSize);
            const results = await P.map(chunks, chunk => this.getSystemDetailsBatch(chunk, refresh));
            return _.assign({}, ...results);
        }

        let response = null;
        const queryIds = ids.map(identifier => ({id: {eq: identifier}}));

        try {
            response = await queries.runQuery(BATCH_DETAILS_QUERY, {
                filter: {OR: queryIds},
                order_by: 'display_name',
                order_how: 'ASC',
                limit: pageSize,
                offset: 0
            }, this.getForwardedHeaders(), this.xjoinDetailsMetrics);
        } catch (e) {
            if (retries > 0) {
                log.warn({ error: e, ids, retries }, 'Xjoin fetch failed. Retrying');
                return this.getSystemDetailsBatch(ids, true, retries - 1);
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

    async getSystemsByInsightsId (id) {
        const response = await queries.runQuery(INSIGHTS_ID_QUERY, {
            insights_id: id
        }, this.getForwardedHeaders(), this.xjoinInsightsIdMetrics);

        const transformed = _(response.data.hosts.data)
        .map(({id, display_name, canonical_facts, account, updated, ansible_host}) =>
            ({id, insights_id: canonical_facts.insights_id, display_name, hostname: canonical_facts.fqdn, account, updated, ansible_host}))
        .value();

        transformed.forEach(validateHost);
        return transformed;
    }

    async ping () {
        const response = queries.runQuery(BATCH_DETAILS_QUERY, {limit: 1}, this.getForwardedHeaders());
        assert(Array.isArray(response.data.hosts.data));
    }
}();
