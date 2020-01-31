'use strict';

const _ = require('lodash');
const URI = require('urijs');
const Connector = require('../Connector');

const { host, insecure } = require('../../config').receptor;

const metrics = require('../metrics');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.statusMetrics = metrics.createConnectorMetric(this.getName, 'getConnectionStatus');
        this.statusMetrics = metrics.createConnectorMetric(this.getName, 'postInitialRequest');
    }

    async getConnectionStatus (account_num, node) {
        const uri = new URI(host);
        uri.path('/connection/status');

        const result = await this.doHttp ({
            uri: uri.toString(),
            method: 'POST',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders(),
            body: {
                account: account_num,
                node_id: node
            }
        }, this.statusMetrics);

        if (_.isEmpty(result)) {
            return null;
        }

        return result;
    }

    async postInitialRequest (receptorWorkRequest) {
        const uri = new URI(host);
        uri.path('/job');

        const result = await this.doHttp ({
            uri: uri.toString(),
            method: 'POST',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders(),
            body: {
                receptorWorkRequest
            }
        }, this.statusMetrics);

        if (_.isEmpty(result)) {
            return null;
        }

        return result;
    }

    async ping () {
        const result = await this.getConnectionStatus('540155', 'node-a');
        result.should.have.property('status', 'connected');
    }
}();
