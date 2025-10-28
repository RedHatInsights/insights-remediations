'use strict';

const _ = require('lodash');
const P = require('bluebird');
const {host, insecure, revalidationInterval, pageSize} = require('../../config').inventory;
const assert = require('assert');
const config = require('../../config');

const Connector = require('../Connector');
const metrics = require('../metrics');
const log = require('../../util/log');
const errors = require('../../errors');

const SATELLITE_NAMESPACE = 'satellite';

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
        this.hostsMetrics = metrics.createConnectorMetric(this.getName(), 'getSystemsByOwnerId');
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

    async getSystemInfoBatch (ids = [], refresh = false, retries = 2) {
        if (ids.length === 0) {
            return {};
        }

        if (ids.length > pageSize) {
            const chunks = _.chunk(ids, pageSize);
            const results = await P.map(chunks, chunk => this.getSystemInfoBatch(chunk, refresh));
            return _.assign({}, ...results);
        }

        const uri = this.buildHostsUri();
        uri.segment(ids.join());
        uri.addQuery('fields[system_profile]', ['is_marketplace', 'satellite_managed', 'rhc_client_id']);
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
                return this.getSystemInfoBatch(ids, true, retries - 1);
            }

            throw e;
        }

        // Handle 403 responses from inventory service
        // Other status codes are handled by doHttp throwing StatusCodeError
        // At this point, if response is null, we know inventory returned:
        // - 403 Forbidden: User lacks inventory:hosts:read permission
        if (!response) {
            log.warn({ ids }, 'Inventory service returned 403 for system info batch request');
            throw new errors.Forbidden('Access to inventory service denied. You don\'t have the required \'inventory:hosts:read\' permission. Please check your RBAC permissions.');
        }

        const transformed = _(response.results)
            .keyBy('id')
            .mapValues(system => {
                const satelliteFacts = _(system.facts).find(
                    fact => ((fact?.namespace === SATELLITE_NAMESPACE) ? fact.facts : false)
                )?.facts;

                return {
                    id: system.id,
                    display_name: system.display_name,
                    hostname: system.fqdn,
                    ansible_host: system.ansible_host,
                    facts: system.facts,                                         // TODO: do we need this?
                    satelliteId: satelliteFacts?.satellite_instance_id || null,
                    satelliteOrgId: satelliteFacts?.organization_id || null,
                    satelliteVersion: satelliteFacts?.satellite_version || null, // TODO: we don't need this
                    rhc_client:  system.system_profile?.rhc_client_id || null,
                    marketplace: system.system_profile?.is_marketplace || false,
                    satelliteManaged: system.system_profile?.satellite_managed || false
                };
            })
            .value();

        // ensure id, display_name and hostname are present
        const result = validate(transformed);

        return result;
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

        // Handle 403 responses from inventory service
        // Other status codes are handled by doHttp throwing StatusCodeError
        // At this point, if response is null, we know inventory returned:
        // - 403 Forbidden: User lacks inventory:hosts:read permission
        if (!response) {
            log.warn({ ids }, 'Inventory service returned 403 for system details batch request');
            throw new errors.Forbidden('Access to inventory service denied. You don\'t have the required \'inventory:hosts:read\' permission. Please check your RBAC permissions.');
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
        uri.addQuery('fields[system_profile]', 'owner_id,rhc_client_id,is_marketplace');

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

        // Handle 403 responses from inventory service
        // Other status codes are handled by doHttp throwing StatusCodeError
        // At this point, if response is null, we know inventory returned:
        // - 403 Forbidden: User lacks inventory:hosts:read permission
        if (!response) {
            log.warn({ ids }, 'Inventory service returned 403 for system profile batch request');
            throw new errors.Forbidden('Access to inventory service denied. You don\'t have the required \'inventory:hosts:read\' permission. Please check your RBAC permissions.');
        }

        const transformed = _(response.results)
        .keyBy('id')
        .mapValues(({id, system_profile}) =>
            ({id, system_profile}))
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
        .map(({id, insights_id, display_name, fqdn: hostname, org_id: tenant_org_id, account, updated, ansible_host}) =>
            ({id, insights_id, display_name, hostname, account, tenant_org_id, updated, ansible_host}))
        .value();

        transformed.forEach(validateHost);
        return transformed;
    }

    async getSystemsByOwnerId (owner_id, refresh = false, retries = 2) {
        const uri = this.buildHostsUri();
        uri.addQuery('per_page', String(pageSize));
        uri.addQuery('filter[system_profile][owner_id]', owner_id);

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
                key: `remediations|http-cache|inventory|owner-id|${owner_id}`,
                refresh,
                revalidationInterval,
                cacheable: body => body.count > 0 // only cache responses with at least 1 record
            },
            this.hostsMetrics);
        } catch (e) {
            if (retries > 0) {
                log.warn({ error: e, retries }, 'Inventory fetch failed. Retrying');
                return this.getSystemsByOwnerId(owner_id, false, retries - 1);
            }

            throw e;
        }

        // Handle 403 responses from inventory service
        // Other status codes are handled by doHttp throwing StatusCodeError
        // At this point, if response is null, we know inventory returned:
        // - 403 Forbidden: User lacks inventory:hosts:read permission
        if (!response) {
            log.warn({ owner_id }, 'Inventory service returned 403 for systems by owner ID request');
            throw new errors.Forbidden('Access to inventory service denied. You don\'t have the required \'inventory:hosts:read\' permission. Please check your RBAC permissions.');
        }

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
