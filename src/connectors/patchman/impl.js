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

    getErratum (id, refresh = false) {
        const uri = new URI(host);
        uri.path('/api/patch/v1/advisories');
        uri.segment(id);

        return this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            headers: this.getForwardedHeaders()
        },
        {
            refresh,
            revalidationInterval
        },
        this.metrics
        ).then(res => _.get(res, ['data'], null));
    }

    async ping () {
        const result = await this.getCve('RHBA-2019:0689', true);
        assert(result.synopsis === 'RHBA-2019:0689');
    }
}();
