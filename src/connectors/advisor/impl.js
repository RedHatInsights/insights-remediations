'use strict';

const _ = require('lodash');
const assert = require('assert');

const Connector = require('../Connector');
const StatusCodeError = require('../StatusCodeError');
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

    async getRule (httpReq, id, refresh = false) {
        const uri = this.buildBaseUri(host, 'advisor', 'v1');
        uri.segment('rule');
        uri.segment(id);

        try {
            return await this.doHttp({
                uri: uri.toString(),
                method: 'GET',
                json: true,
                rejectUnauthorized: !insecure,
                headers: {
                    ...this.getForwardedHeaders(httpReq)
                }
            }, {
                refresh,
                revalidationInterval
            },
            this.ruleMetrics,
            undefined,
            httpReq);
        } catch (e) {
            if (e instanceof StatusCodeError && e.statusCode === 404) {
                return null;
            }

            throw e;
        }
    }

    async getDiagnosis (httpReq, system, branchId = null) {
        const uri = this.buildBaseUri();
        uri.segment('system');
        uri.segment(system);
        uri.segment('reports');

        if (branchId) {
            uri.segment('/'); // Quirk of the Advisor API
            uri.query({branch_id: branchId});
        }

        let data;
        try {
            data = await this.doHttp({
                uri: uri.toString(),
                method: 'GET',
                json: true,
                rejectUnauthorized: !insecure,
                headers: {
                    ...this.getForwardedHeaders(httpReq)
                }
            }, false, this.diagnosisMetrics, undefined, httpReq);
        } catch (e) {
            if (e instanceof StatusCodeError && e.statusCode === 404) {
                return {};
            }

            throw e;
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

    async getSystems (httpReq, id) {
        const uri = this.buildBaseUri(host, 'advisor', 'v1');
        uri.segment('rule');
        uri.segment(id);
        uri.segment('systems');

        let data;
        try {
            data = await this.doHttp({
                uri: uri.toString(),
                method: 'GET',
                json: true,
                rejectUnauthorized: !insecure,
                headers: this.getForwardedHeaders(httpReq)
            },
            false,
            this.systemsMetrics,
            undefined,
            httpReq);
        } catch (e) {
            if (e instanceof StatusCodeError && e.statusCode === 404) {
                return [];
            }

            throw e;
        }

        return data.host_ids;
    }

    async ping () {
        const result = await this.getRule(null, 'network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE', true);
        assert(result !== null);
    }
}();
