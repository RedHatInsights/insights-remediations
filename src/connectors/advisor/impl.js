'use strict';

const _ = require('lodash');

const Connector = require('../Connector');
const URI = require('urijs');
const {host, insecure} = require('../../config').advisor;

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    getRule (id) {
        const uri = new URI(host);
        uri.path('/r/insights/platform/advisor/v1/rule/');
        uri.segment(id);

        return this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: {
                ...this.getForwardedHeaders()
            }
        }, true);
    }

    async getDiagnosis (system) {
        const uri = new URI(host);
        uri.path('/r/insights/platform/advisor/v1/system/');
        uri.segment(system);
        uri.segment('reports');

        const data = await this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: {
                ...this.getForwardedHeaders()
            }
        }, false);

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

    ping () {
        return this.getRule('network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE');
    }
}();
