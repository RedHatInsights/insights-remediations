'use strict';

const fs = require('fs');
const path = require('path');
const URI = require('urijs');
const assert = require('assert');
const Connector = require('../Connector');
const StatusCodeError = require('../StatusCodeError');

const {host, insecure, auth, env, clientId, revalidationInterval, testAccount} = require('../../config').users;

/* eslint-disable security/detect-non-literal-fs-filename */
const cert = fs.readFileSync(path.resolve(__dirname, '../../../certs/backoffice-proxy.crt'));
const ca = fs.readFileSync(path.resolve(__dirname, '../../../certs/backoffice-proxy.ca.crt'));
/* eslint-enable security/detect-non-literal-fs-filename */
const metrics = require('../metrics');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.metrics = metrics.createConnectorMetric(this.getName());
    }

    async getUser (req, id, refresh = false) {
        const uri = new URI(host);
        uri.path('/v1/users');

        let result;
        try {
            result = await this.doHttp({
                uri: uri.toString(),
                method: 'POST',
                json: true,
                ca,
                cert,
                rejectUnauthorized: !insecure,
                headers: {
                    'x-rh-apitoken': auth,
                    'x-rh-insights-env': env,
                    'x-rh-clientid': clientId,
                    ...this.getForwardedHeaders(req, false)
                },
                body: {
                    users: [id]
                }
            }, {
                refresh,
                key: `remediations|http-cache|users|${id}`,
                revalidationInterval,
                cacheable: body => body.length === 1 // only cache responses with exactly 1 match
            }, this.metrics, undefined, req);
        } catch (e) {
            if (e instanceof StatusCodeError && e.statusCode === 404) {
                return null;
            }
            throw e;
        }

        if (result.length !== 1) {
            return null;
        }

        return result[0];
    }

    async ping () {
        const result = await this.getUser(null, testAccount, true);
        assert(result.username === testAccount);
    }
}();
