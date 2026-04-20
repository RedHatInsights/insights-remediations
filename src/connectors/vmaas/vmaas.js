'use strict';

const assert = require('assert');
const _ = require('lodash');
const { host, revalidationInterval } = require('../../config').vmaas;
const URI = require('urijs');
const Connector = require('../Connector');
const StatusCodeError = require('../StatusCodeError');
const metrics = require('../metrics');
const getTrace = require('../../util/trace');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.metrics = metrics.createConnectorMetric(this.getName());
    }

    async getErratum (req, id) {
        const uri = new URI(host);
        uri.path('/api/vmaas/v3/errata');
        uri.segment(id);

        try {
            const res = await this.doHttp({
                uri: uri.toString(),
                method: 'GET',
                json: true,
                headers: this.getForwardedHeaders(req, false)
            }, false, undefined, undefined, req);
            return _.get(res, ['errata_list', id], null);
        } catch (e) {
            if (e instanceof StatusCodeError && e.statusCode === 404) {
                return null;
            }
            throw e;
        }
    }

    async getCve (req, id, refresh = false) {
        getTrace(req).enter('connectors/vmaas/vmaas.getCve');

        const uri = new URI(host);
        uri.path('/api/vmaas/v3/cves');
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

        getTrace(req).event(`GET options: ${options}`);
        getTrace(req).event(`GET caching: ${caching}`);

        try {
            const res = await this.doHttp(options, caching, this.metrics, undefined, req);
            getTrace(req).event(`Got data back!`);
            getTrace(req).leave();
            return _.get(res, ['cve_list', id], null);
        } catch (e) {
            if (e instanceof StatusCodeError && e.statusCode === 404) {
                getTrace(req).leave('Not found (404)');
                return null;
            }
            throw e;
        }
    }

    async getPackage (req, id, refresh = false) {
        const uri = new URI(host);
        uri.path('/api/vmaas/v3/packages');
        uri.segment(id);

        try {
            const res = await this.doHttp({
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
            this.metrics,
            undefined,
            req);
            return _.get(res, ['package_list', id], null);
        } catch (e) {
            if (e instanceof StatusCodeError && e.statusCode === 404) {
                return null;
            }
            throw e;
        }
    }

    async ping () {
        const result = await this.getCve(null, 'CVE-2017-17712', true);
        assert(result.synopsis === 'CVE-2017-17712');
    }
}();
