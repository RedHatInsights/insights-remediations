'use strict';

const _ = require('lodash');
const assert = require('assert');
const Connector = require('../Connector');

const { host } = require('../../config').configManager;

const metrics = require('../metrics');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.currentProfile = metrics.createConnectorMetric(this.getName(), 'getCurrentProfile');
    }

    async getCurrentProfile (req) {
        const uri = this.buildUri(host, 'config-manager', 'v2');
        uri.segment('profiles');
        uri.segment('current');

        const options = {
            uri: uri.toString(),
            method: 'GET',
            json: true,
            headers: this.getForwardedHeaders(req)
        };

        const result = await this.doHttp (req, options, false, this.currentProfile);

        if (!result) {
            return null;
        }

        return result;
    }

    async ping (req) {
        const results = await this.getCurrentProfile(req);
        assert(_.isObject(results));
    }
}();
