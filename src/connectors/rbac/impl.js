'use strict';

const _ = require('lodash');
const assert = require('assert');
const URI = require('urijs');
const Connector = require('../Connector');

const { host, insecure } = require('../../config').rbac;
const metrics = require('../metrics');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.accessMetrics = metrics.createConnectorMetric(this.getName, 'getRemediationsAccess');
    }

    async getRemediationsAccess () {
        const uri = new URI(host);
        uri.path('/api/rbac/v1/access/');
        uri.query({application: 'remediations'});

        const result = await this.doHttp ({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders()
        }, this.accessMetrics);

        if (_.isEmpty(result)) {
            return null;
        }

        return result;
    }

    async ping () {
        const result = await this.getRemediationsAccess();
        assert(result !== null);
    }
}();
