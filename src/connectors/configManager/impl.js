'use strict';

const _ = require('lodash');
const assert = require('assert');
const Connector = require('../Connector');

const { host } = require('../../config').configManager;

const metrics = require('../metrics');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.currentState = metrics.createConnectorMetric(this.getName(), 'getCurrentState');
    }

    async getCurrentState () {
        const uri = this.buildUri(host, 'api', 'config-manager', 'v1');
        uri.segment('states');
        uri.segment('current');

        const options = {
            uri: uri.toString(),
            method: 'GET',
            json: true,
            headers: this.getForwardedHeaders()
        };

        const result = await this.doHttp (options, false, this.currentState);

        if (!result) {
            return null;
        }

        return result;
    }

    async ping () {
        const results = await this.getCurrentState();

        assert(_.isObject(results));
    }
}();
