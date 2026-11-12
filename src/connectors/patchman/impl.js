'use strict';

const assert = require('assert');
const _ = require('lodash');
const { host, revalidationInterval } = require('../../config').patchman;
const URI = require('urijs');
const Connector = require('../Connector');
const StatusCodeError = require('../StatusCodeError');
const metrics = require('../metrics');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.metrics = metrics.createConnectorMetric(this.getName());
        this.templateMetrics = metrics.createConnectorMetric(this.getName(), 'getTemplateSystemIds');
    }

    async getErratum (id, refresh = false) {
        const uri = new URI(host);
        uri.path('/api/patch/v3/advisories');
        uri.segment(id);

        try {
            const res = await this.doHttp({
                uri: uri.toString(),
                method: 'GET',
                json: true,
                headers: this.getForwardedHeaders()
            },
            {
                refresh,
                revalidationInterval
            },
            this.metrics);

            return _.get(res, ['data'], null);
        } catch (e) {
            if (e instanceof StatusCodeError && e.statusCode === 404) {
                return null;
            }

            throw e;
        }
    }

    async getTemplateSystemIds (systemIds) {
        const uri = new URI(host);
        uri.path('/api/patch/v3/systems');
        uri.search({
            'filter[id]': `in:${systemIds.join(',')}`,
            'filter[template_uuid]': 'neq:null',
            limit: -1
        });

        const res = await this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            headers: this.getForwardedHeaders()
        }, false, this.templateMetrics);

        const ids = _.get(res, ['data'], []).map(system => system.id);
        return new Set(ids);
    }

    async ping () {
        const result = await this.getErratum('RHBA-2019:0689', true);
        assert(result.id === 'RHBA-2019:0689');
    }
}();
