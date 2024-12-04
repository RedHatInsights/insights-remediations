'use strict';

const assert = require('assert');
const _ = require('lodash');
const { host, revalidationInterval } = require('../../config').vmaas;
const URI = require('urijs');
const Connector = require('../Connector');
const metrics = require('../metrics');
const trace = require('../../util/trace');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.metrics = metrics.createConnectorMetric(this.getName());
    }

    getErratum (req, id) {
        const uri = new URI(host);
        uri.path('/api/v1/errata');
        uri.segment(id);

        return this.doHttp(req, {
            uri: uri.toString(),
            method: 'GET',
            json: true,
            headers: this.getForwardedHeaders(req, false)
        }, false)
        .then(res => _.get(res, ['errata_list', id], null));
    }

    getCve (req, id, refresh = false) {
        trace.enter('connectors/vmaas/vmaas.getCve');

        const uri = new URI(host);
        uri.path('/api/v1/cves');
        uri.segment(id);

        const options = {
            uri: uri.toString(),
            method: 'GET',
            json: true,
            headers: this.getForwardedHeaders(req, false)
        };

        const caching = {
            refresh,
            revalidationInterval,
            cacheable: body => body.pages === 1 // only cache responses with exactly 1 match
        };

        trace.event(`GET options: ${options}`);
        trace.event(`GET caching: ${caching}`);

        const promise = this.doHttp(req, options, caching, this.metrics)
            .then(res => {
                trace.event(`Got data back!`);
                return _.get(res, ['cve_list', id], null);
            });

        trace.leave(`Returning promise: ${JSON.stringify(promise)}`);
        return promise;
    }

    // Not being used??
    getPackage (req, id, refresh = false) {
        const uri = new URI(host);
        uri.path('/api/v1/packages');
        uri.segment(id);

        return this.doHttp(req, {
            uri: uri.toString(),
            method: 'GET',
            json: true,
            headers: this.getForwardedHeaders(req, false)
        },
        {
            refresh,
            revalidationInterval,
            cacheable: body => body.pages === 1 // only cache responses with exactly 1 match
        },
        this.metrics
        ).then(res => _.get(res, ['package_list', id], null));
    }

    async ping (req) {
        const result = await this.getCve(req, 'CVE-2017-17712', true);
        assert(result.synopsis === 'CVE-2017-17712');
    }
}();
