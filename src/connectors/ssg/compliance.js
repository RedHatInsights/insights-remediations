'use strict';
/* eslint-disable security/detect-object-injection */

const assert = require('assert');
const _ = require('lodash');
const cls = require('../../util/cls');
const log = require('../../util/log');
const {host, insecure, revalidationInterval} = require('../../config').compliance;

const Connector = require('../Connector');
const metrics = require('../metrics');

let REQUESTS = [];
let PROMISES = [];

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.metrics = metrics.createConnectorMetric(this.getName());
    }

    async getTemplate (req, id, refresh = false) {
        const p = new Promise(function(resolve, reject) {
            PROMISES.push({resolve, reject});
        });

        if (_.isEmpty(REQUESTS)) {
            REQUESTS.push(id);

            setTimeout(() => {this.flush(req, refresh);}, 200);
        } else {
            REQUESTS.push(id);
        }

        return p;
    }

    async flush(req, refresh = false) {
        const copyIds = REQUESTS;
        const copyPromises = PROMISES;
        REQUESTS = [];
        PROMISES = [];

        // const req = cls.getReq();
        const uri = this.buildUri(host, 'compliance', 'rules');
        uri.segment(copyIds.join());

        try {
            const results = await this.doHttp(req, {
                uri: uri.toString(),
                method: 'POST',
                json: true,
                body: { copyIds },
                rejectUnauthorized: !insecure,
                headers: {
                    ...this.getForwardedHeaders(req)
                }
            },
            {
                key: `remediations|http-cache|compliance|${req.user.account_number}|${copyIds}`,
                refresh,
                revalidationInterval
            },
            this.metrics);

            for (let i = 0; i < copyPromises.length ; ++i) {
                copyPromises[i].resolve(results[i]);
            }
        } catch (e) {
            log.error('Group Compliance fetch failed');
            throw e;
        }
    }

    async ping (req) {
        const result = await this.getRule(req, 'xccdf_org.ssgproject.content_rule_sshd_disable_root_login', true);
        assert(result !== null);
    }
};
