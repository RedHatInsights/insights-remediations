'use strict';

const _ = require('lodash');
const assert = require('assert');

const Connector = require('../Connector');
const {host, insecure, revalidationInterval} = require('../../config').advisor;
const metrics = require('../metrics');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.ruleMetrics = metrics.createConnectorMetric(this.getName(), 'getRule');
        this.diagnosisMetrics = metrics.createConnectorMetric(this.getName(), 'getDiagnosis');
        this.systemsMetrics = metrics.createConnectorMetric(this.getName(), 'getSystems');
    }

    getRule (id, refresh = false) {
        const uri = this.buildUri(host, 'advisor', 'v1', 'rule', id);

        return this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: {
                ...this.getForwardedHeaders()
            }
        }, {
            refresh,
            revalidationInterval
        },
        this.ruleMetrics);
    }

    async getDiagnosis (system) {
        const uri = this.buildUri(host, 'advisor', 'v1', 'system', system, 'reports');

        const data = await this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: {
                ...this.getForwardedHeaders()
            }
        }, false, this.diagnosisMetrics);

        if (!data) {
            return {};
        }

        return _(data.active_reports)
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

    async getSystems (id) {
        const uri = this.buildUri(host, 'advisor', 'v1', 'rule', id, 'systems');

        const data = await this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders()
        },
        false,
        this.systemsMetrics);

        if (!data) {
            return [];
        }

        return data.host_ids;
    }

    async ping () {
        const result = await this.getRule('network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE', true);
        assert(result !== null);
    }
}();
