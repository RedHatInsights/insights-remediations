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

    async getRule (id, securityGuideId = null, refresh = false, retries = 2) {
        id = id.replace(/\./g, '-'); // compliance API limitation
        let uri;

        /* 
        Use Compliance API v1 if the securityGuideId is null which means it wasn't passed in the issueId string
            Ex: ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_service_autofs_disabled
        Use Compliance API v2 if the securityGuideId is not null which means it was passed in the issueId string
            Ex: ssg:rhel7|0021d5a8-6573-4766-8bfd-5f5eab59015c|pci-dss|xccdf_org.ssgproject.content_rule_disable_prelink
        */
        if (!securityGuideId) {
            uri = this.buildUri(host, 'compliance', 'rules', id);
        } else {
            uri = this.buildUri(host, 'compliance', 'v2', 'security_guides', securityGuideId, 'rules', id);
        }

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
                return this.getRule(id, securityGuideId, true, retries - 1);
            }

            throw e;
        }
    }

    async ping () {
        const result = await this.getRule('02aa9f80-f543-4297-ab27-a0f745a79077', 'e0fa5d6f-5234-4750-9f11-b85a9e16822f', true);
        assert(result !== null);
    }
}();

