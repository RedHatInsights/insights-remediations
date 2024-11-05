'use strict';

const _ = require('lodash');
const assert = require('assert');

const Connector = require('../Connector');
const {host, insecure, revalidationInterval} = require('../../config').advisor;
const metrics = require('../metrics');
const config = require('../../config');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.ruleMetrics = metrics.createConnectorMetric(this.getName(), 'getRule');
        this.diagnosisMetrics = metrics.createConnectorMetric(this.getName(), 'getDiagnosis');
        this.systemsMetrics = metrics.createConnectorMetric(this.getName(), 'getSystems');
    }

    buildBaseUri () {
        if (config.path.prefix === '/api') {
            return this.buildUri(host, 'insights', 'v1');
        }

        // TODO: remove once everything is on cloud.redhat.com
        return this.buildUri(host, 'advisor', 'v1');
    }

    getRule (req, id, refresh = false) {
        const uri = this.buildBaseUri(host, 'advisor', 'v1');
        uri.segment('rule');
        uri.segment(id);

        return this.doHttp(req, {
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: {
                ...this.getForwardedHeaders(req)
            }
        }, {
            refresh,
            revalidationInterval
        },
        this.ruleMetrics);
    }

    async getDiagnosis (req, system, branchId = null) {
        const uri = this.buildBaseUri();
        uri.segment('system');
        uri.segment(system);
        uri.segment('reports');

        if (branchId) {
            uri.segment('/'); // Quirk of the Advisor API
            uri.query({branch_id: branchId});
        }

        const data = await this.doHttp(req, {
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: {
                ...this.getForwardedHeaders(req)
            }
        }, false, this.diagnosisMetrics);

        if (!data) {
            return {};
        }

        return _(data)
        .keyBy('rule.rule_id')
        .mapValues(report => report.details)
        .pickBy()

        // workaround for a bug in Advisor API
        // see https://projects.engineering.redhat.com/browse/RHIADVISOR-323
        .mapValues(details => {
            if (typeof details === 'string') {
                return JSON.parse(details);
            }

            return details;
        })
        .value();
    }

    async getSystems (id, req) {
        const uri = this.buildBaseUri(host, 'advisor', 'v1');
        uri.segment('rule');
        uri.segment(id);
        uri.segment('systems');

        const data = await this.doHttp(req, {
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders(req)
        },
        false,
        this.systemsMetrics);

        if (!data) {
            return [];
        }

        return data.host_ids;
    }

    async ping (req) {
        const result = await this.getRule(req, 'network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE', true);
        assert(result !== null);
    }
}();
