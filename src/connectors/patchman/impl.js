'use strict';

const assert = require('assert');
const _ = require('lodash');
const { host, revalidationInterval } = require('../../config').patchman;
const URI = require('urijs');
const Connector = require('../Connector');
const metrics = require('../metrics');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.metrics = metrics.createConnectorMetric(this.getName());
    }

    getErratum (req, id, refresh = false) {
        const uri = new URI(host);
        uri.path('/api/patch/v3/advisories');
        uri.segment(id);

        return this.doHttp(req, {
            uri: uri.toString(),
            method: 'GET',
            json: true,
            headers: this.getForwardedHeaders(req)
        },
        {
            refresh,
            revalidationInterval
        },
        this.metrics
        ).then(res => _.get(res, ['data'], null));
    }

    async ping (req) {
        const result = await this.getErratum(req, 'RHBA-2019:0689', true);
        assert(result.id === 'RHBA-2019:0689');
    }
}();
