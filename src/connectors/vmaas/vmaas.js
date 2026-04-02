'use strict';

const assert = require('assert');
const _ = require('lodash');
const { host, revalidationInterval } = require('../../config').vmaas;
const URI = require('urijs');
const Connector = require('../Connector');
const StatusCodeError = require('../StatusCodeError');
const metrics = require('../metrics');
const trace = require('../../util/trace');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.metrics = metrics.createConnectorMetric(this.getName());
    }

    async getErratum (id) {
        const uri = new URI(host);
        uri.path('/api/vmaas/v3/errata');
        uri.segment(id);

        try {
            const res = await this.doHttp({
                uri: uri.toString(),
                method: 'GET',
                json: true,
                headers: this.getForwardedHeaders(false)
            }, false);
            return _.get(res, ['errata_list', id], null);
        } catch (e) {
            if (e instanceof StatusCodeError && e.statusCode === 404) {
                return null;
            }
            throw e;
        }
    }

    async getCve (id, refresh = false) {
        trace.enter('connectors/vmaas/vmaas.getCve');

        const uri = new URI(host);
        uri.path('/api/vmaas/v3/cves');
        uri.segment(id);

        const options = {
            uri: uri.toString(),
            method: 'GET',
            json: true,
            headers: this.getForwardedHeaders(false)
        };

        const caching = {
            refresh,
            revalidationInterval,
            cacheable: body => body.pages === 1 // only cache responses with exactly 1 match
        };

        trace.event(`GET options: ${options}`);
        trace.event(`GET caching: ${caching}`);

        try {
            const res = await this.doHttp(options, caching, this.metrics);
            trace.event(`Got data back!`);
            trace.leave();
            return _.get(res, ['cve_list', id], null);
        } catch (e) {
            if (e instanceof StatusCodeError && e.statusCode === 404) {
                trace.leave('Not found (404)');
                return null;
            }
            throw e;
        }
    }

    async getPackage (id, refresh = false) {
        const uri = new URI(host);
        uri.path('/api/vmaas/v3/packages');
        uri.segment(id);

        try {
            const res = await this.doHttp({
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
            this.metrics);
            return _.get(res, ['package_list', id], null);
        } catch (e) {
            if (e instanceof StatusCodeError && e.statusCode === 404) {
                return null;
            }
            throw e;
        }
    }

    async ping () {
        const result = await this.getCve('CVE-2017-17712', true);
        assert(result.synopsis === 'CVE-2017-17712');
    }
}();
