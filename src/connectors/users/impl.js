'use strict';

const fs = require('fs');
const path = require('path');
const URI = require('urijs');
const _ = require('lodash');
const assert = require('assert');
const Connector = require('../Connector');

const {host, insecure, auth, env} = require('../../config').users;

const cert = fs.readFileSync(path.resolve(__dirname, '../../../certs/backoffice-proxy.crt'));
const ca = fs.readFileSync(path.resolve(__dirname, '../../../certs/backoffice-proxy.ca.crt'));

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    async getUsers (ids = []) {
        assert(Array.isArray(ids));

        if (!ids.length) {
            return {};
        }

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
                'x-rh-insights-env': env
            },
            body: {
                users: ids
            }
        }, true);

        return _.keyBy(result, 'username');
    }

    async ping () {
        const result = await this.getUsers(['***REMOVED***']);
        assert(result['***REMOVED***'].username === '***REMOVED***');
    }
}();
