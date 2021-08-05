'use strict';

const assert = require('assert');
const _ = require('lodash');
const log = require('../../util/log');
const {host, insecure, revalidationInterval} = require('../../config').compliance;

const Connector = require('../Connector');
const metrics = require('../metrics');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.metrics = metrics.createConnectorMetric(this.getName());
    }

    async getRule (id, refresh = false, retries = 2) {
        id = id.replace(/\./g, '-'); // compliance API limitation

        const uri = this.buildUri(host, 'compliance', 'rules', id);

        try {
            const result = await this.doHttp({
                uri: uri.toString(),
                method: 'GET',
                json: true,
                rejectUnauthorized: !insecure,
                headers: {
                    ...this.getForwardedHeaders()
                }
            },
            {
                key: `remediations|http-cache|compliance|${host}|${id}`,
                refresh,
                revalidationInterval
            },
            this.metrics);

            return _.get(result, 'data.attributes', null);
        } catch (e) {
            if (retries > 0) {
                log.warn({ error: e, id, retries }, 'Compliance fetch failed. Retrying');
                return this.getRule(id, true, retries - 1);
            }

            throw e;
        }
    }

    async ping () {
        const result = await this.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login', true);
        assert(result !== null);
    }
}();

