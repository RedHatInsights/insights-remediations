'use strict';

const fs = require('fs');
const path = require('path');
const URI = require('urijs');
const assert = require('assert');
const Connector = require('../Connector');

const {host, insecure, auth, env, revalidationInterval} = require('../../config').users;

const cert = fs.readFileSync(path.resolve(__dirname, '../../../certs/backoffice-proxy.crt'));
const ca = fs.readFileSync(path.resolve(__dirname, '../../../certs/backoffice-proxy.ca.crt'));
const metrics = require('../metrics');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.metrics = metrics.createConnectorMetric(this.getName());
    }

    async getUser (id) {
        const uri = new URI(host);
        uri.path('/v1/users');

        const result = await this.doHttp({
            uri: uri.toString(),
            method: 'POST',
            json: true,
            ca,
            cert,
            rejectUnauthorized: !insecure,
            headers: {
                'x-rh-apitoken': auth,
                'x-rh-insights-env': env,
                ...this.getForwardedHeaders(false)
            },
            body: {
                users: [id]
            }
        }, {
            key: `remediations|http-cache|users|${id}`,
            revalidationInterval
        }, this.metrics);

        if (result.length !== 1) {
            return null;
        }

        return result[0];
    }

    async ping () {
        const result = await this.getUser('***REMOVED***');
        assert(result.username === '***REMOVED***');
    }
}();
