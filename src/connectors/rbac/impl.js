'use strict';

const fs = require('fs');
const _ = require('lodash');
const assert = require('assert');
const URI = require('urijs');
const Connector = require('../Connector');
const StatusCodeError = require('../StatusCodeError');
const log = require('../../util/log');

const { host, insecure, authenticated, caCert: caCertPath } = require('../../config').rbac;
const { getV2BearerToken, applyV2CaCert } = require('../../util/v2Auth');
const metrics = require('../metrics');

// Read V2 CA cert once at module load
const caCertBuffer = caCertPath // eslint-disable-line security/detect-non-literal-fs-filename
    ? fs.readFileSync(caCertPath) : null;

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.accessMetrics = metrics.createConnectorMetric(this.getName(), 'getRemediationsAccess');
    }

    async getRemediationsAccess (retries = 2) {
        const uri = new URI(host);
        uri.path('/api/rbac/v1/access/');
        uri.query({application: 'remediations'});

        const headers = this.getForwardedHeaders();

        // V2 authenticated endpoint: attach bearer for cross-cluster gateway auth
        if (authenticated) {
            const token = await getV2BearerToken();
            headers.Authorization = `Bearer ${token}`;
        }

        const options = applyV2CaCert({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers
        }, caCertBuffer);

        try {
            const result = await this.doHttp (options, false, this.accessMetrics);

            if (_.isEmpty(result)) {
                return null;
            }

            return result;
        } catch (e) {
            if (e instanceof StatusCodeError && e.statusCode === 404) {
                return null;
            }

            if (retries > 0) {
                log.warn({ error: e, retries }, 'RBAC access fetch failed. Retrying');
                return this.getRemediationsAccess(retries - 1);
            }

            throw e;
        }
    }

    async ping () {
        const result = await this.getRemediationsAccess();
        assert(result !== null);
    }
}();
