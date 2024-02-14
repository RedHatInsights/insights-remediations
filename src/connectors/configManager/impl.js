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

    async getCurrentProfile () {
        const uri = this.buildUri(host, 'config-manager', 'v2');
        uri.segment('profiles');
        uri.segment('current');

        const options = {
            uri: uri.toString(),
            method: 'GET',
            json: true,
            headers: this.getForwardedHeaders()
        };

        const result = await this.doHttp (options, false, this.currentProfile);

        if (!result) {
            return null;
        }

        return result;
    }

    async ping () {
        const results = await this.getCurrentProfile();
        assert(_.isObject(results));
    }
}();
