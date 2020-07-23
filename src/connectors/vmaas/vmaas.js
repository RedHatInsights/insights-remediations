'use strict';

const assert = require('assert');
const _ = require('lodash');
const { host, revalidationInterval } = require('../../config').vmaas;
const URI = require('urijs');
const Connector = require('../Connector');
const metrics = require('../metrics');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.metrics = metrics.createConnectorMetric(this.getName());
    }

    getErratum (id) {
        const uri = new URI(host);
        uri.path('/api/v1/errata');
        uri.segment(id);

        return this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            headers: this.getForwardedHeaders(false)
        }, false)
        .then(res => _.get(res, ['errata_list', id], null));
    }

    getCve (id, refresh = false) {
        const uri = new URI(host);
        uri.path('/api/v1/cves');
        uri.segment(id);

        return this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            headers: this.getForwardedHeaders(false)
        },
        {
            refresh,
            revalidationInterval,
            cacheable: body => body.pages === 1 // only cache responses with exactly 1 match
        },
        this.metrics
        ).then(res => _.get(res, ['cve_list', id], null));
    }

    getPackage (id, refresh = false) {
        const uri = new URI(host);
        uri.path('/api/v1/packages');
        uri.segment(id);

        return this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            headers: this.getForwardedHeaders(false)
        },
        {
            refresh,
            revalidationInterval,
            cacheable: body => body.pages === 1 // only cache responses with exactly 1 match
        },
        this.metrics
        ).then(res => _.get(res, ['package_list', id], null));
    }

    async ping () {
        const result = await this.getCve('CVE-2017-17712', true);
        assert(result.synopsis === 'CVE-2017-17712');
    }
}();
