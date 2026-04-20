'use strict';
/* eslint-disable security/detect-object-injection */

const assert = require('assert');
const _ = require('lodash');
const log = require('../../util/log');
const {host, insecure, revalidationInterval} = require('../../config').compliance;

const Connector = require('../Connector');
const StatusCodeError = require('../StatusCodeError');
const metrics = require('../metrics');

let REQUESTS = [];
let PROMISES = [];

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.metrics = metrics.createConnectorMetric(this.getName());
    }

    async getTemplate (req, id, refresh = false) {
        this._batchHttpReq = req;
        const p = new Promise(function(resolve, reject) {
            PROMISES.push({resolve, reject});
        });

        if (_.isEmpty(REQUESTS)) {
            REQUESTS.push(id);

            setTimeout(() => {this.flush(refresh);}, 200);
        } else {
            REQUESTS.push(id);
        }

        return p;
    }

    async flush(refresh = false) {
        const copyIds = REQUESTS;
        const copyPromises = PROMISES;
        REQUESTS = [];
        PROMISES = [];

        const httpReq = this._batchHttpReq;
        const uri = this.buildUri(host, 'compliance', 'rules');
        uri.segment(copyIds.join());

        const accountKey = httpReq?.user?.account_number ?? 'internal';

        try {
            const results = await this.doHttp({
                uri: uri.toString(),
                method: 'POST',
                json: true,
                body: { copyIds },
                rejectUnauthorized: !insecure,
                headers: {
                    ...this.getForwardedHeaders(httpReq)
                }
            },
            {
                key: `remediations|http-cache|compliance|${accountKey}|${copyIds}`,
                refresh,
                revalidationInterval
            },
            this.metrics,
            undefined,
            httpReq);

            for (let i = 0; i < copyPromises.length ; ++i) {
                copyPromises[i].resolve(results[i]);
            }
        } catch (e) {
            if (e instanceof StatusCodeError && e.statusCode === 404) {
                for (let i = 0; i < copyPromises.length ; ++i) {
                    copyPromises[i].resolve(null);
                }
                return;
            }
            log.error('Group Compliance fetch failed');
            throw e;
        }
    }

    async ping () {
        const result = await this.getTemplate(null, 'xccdf_org.ssgproject.content_rule_sshd_disable_root_login');
        assert(result !== null);
    }
}();
