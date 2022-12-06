'use strict';

const fs = require('fs');
const path = require('path');
const URI = require('urijs');
const assert = require('assert');
const Connector = require('../Connector');

const {host, insecure, auth, env, clientId, revalidationInterval, testAccount} = require('../../config').users;

/* eslint-disable security/detect-non-literal-fs-filename */
const cert = fs.readFileSync(path.resolve(__dirname, '../../../certs/backoffice-proxy.crt'));
const ca = fs.readFileSync(path.resolve(__dirname, '../../../certs/backoffice-proxy.ca.crt'));
/* eslint-enable security/detect-non-literal-fs-filename */
const metrics = require('../metrics');
const cls = require("../../util/cls");

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.metrics = metrics.createConnectorMetric(this.getName());
    }

    async getUser (id, refresh = false) {
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
                'x-rh-clientid': clientId,
                ...this.getForwardedHeaders(false)
            },
            body: {
                users: [id]
            }
        }, {
            refresh,
            key: `remediations|http-cache|users|${id}`,
            revalidationInterval,
            cacheable: body => body.length === 1 // only cache responses with exactly 1 match
        }, this.metrics);

        if (result.length !== 1) {
            return null;
        }

        return result[0];
    }

    async ping () {
        const req = cls.getReq();

        if (req.identity.type === 'User') {
            const result = await this.getUser(req.identity.user.username, true);
            assert(result.username === req.identity.user.username);
        }

        else {
            const result = await this.getUser(testAccount, true);
            assert(result.username === testAccount);
        }
    }
}();
