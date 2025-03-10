'use strict';

const _ = require('lodash');
const URI = require('urijs');
const Connector = require('../Connector');

const { host, insecure } = require('../../config').receptor;

const metrics = require('../metrics');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.statusMetrics = metrics.createConnectorMetric(this.getName(), 'getConnectionStatus');
        this.statusMetrics = metrics.createConnectorMetric(this.getName(), 'postInitialRequest');
    }

    async getConnectionStatus (req, account_num, node) {
        const uri = new URI(host);
        uri.path('/connection/status');

        const result = await this.doHttp (req, {
            uri: uri.toString(),
            method: 'POST',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders(req),
            body: {
                account: account_num,
                node_id: node
            }
        }, false, this.statusMetrics);

        if (_.isEmpty(result)) {
            return null;
        }

        return result;
    }

    async postInitialRequest (req, receptorWorkRequest) {
        const uri = new URI(host);
        uri.path('/job');

        const result = await this.doHttp (req, {
            uri: uri.toString(),
            method: 'POST',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders(req),
            body: receptorWorkRequest
        }, false, this.statusMetrics);

        if (_.isEmpty(result)) {
            return null;
        }

        return result;
    }

    async ping (req) {
        await this.getConnectionStatus(req, '540155', 'node-a');
    }
}();
