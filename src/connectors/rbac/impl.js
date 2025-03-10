'use strict';

const _ = require('lodash');
const assert = require('assert');
const URI = require('urijs');
const Connector = require('../Connector');
const log = require('../../util/log');

const { host, insecure } = require('../../config').rbac;
const metrics = require('../metrics');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.accessMetrics = metrics.createConnectorMetric(this.getName(), 'getRemediationsAccess');
    }

    async getRemediationsAccess (req, retries = 2) {
        const uri = new URI(host);
        uri.path('/api/rbac/v1/access/');
        uri.query({application: 'remediations'});

        try {
            const result = await this.doHttp (req, {
                uri: uri.toString(),
                method: 'GET',
                json: true,
                rejectUnauthorized: !insecure,
                headers: this.getForwardedHeaders(req)
            }, false, this.accessMetrics);

            if (_.isEmpty(result)) {
                return null;
            }

            return result;
        } catch (e) {
            if (retries > 0) {
                log.warn({ error: e, retries }, 'RBAC access fetch failed. Retrying');
                return this.getRemediationsAccess(req, retries - 1);
            }

            throw e;
        }
    }

    async ping (req) {
        const result = await this.getRemediationsAccess(req);
        assert(result !== null);
    }
}();
