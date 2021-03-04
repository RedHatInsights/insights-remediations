'use strict';

const _ = require('lodash');
const URI = require('urijs');
const {host, insecure, auth} = require('../../config').dispatcher;

const Connector = require('../Connector');
const metrics = require('../metrics');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.postRunRequests = metrics.createConnectorMetric(this.getName(), 'postPlaybookRunRequests');
    }

    async postPlaybookRunRequests (dispatcherWorkRequest) {
        const uri = new URI(host);
        uri.segment('internal');
        uri.segment('dispatch');

        const options = {
            uri: uri.toString(),
            method: 'POST',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders(),
            body: dispatcherWorkRequest
        };

        // This header should be sent to the playbook dispatcher for each internal request.
        if (auth) {
            options.headers = {
                Authorization: `PSK ${auth}`
            };
        }

        const result = await this.doHttp (options, false, this.postRunRequests);

        if (_.isEmpty(result)) {
            return null;
        }

        return result;
    }

    async ping () {}
}();
