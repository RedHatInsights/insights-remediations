'use strict';

const _ = require('lodash');
const P = require('bluebird');
const URI = require('urijs');
const {host, insecure} = require('../../config').inventory;
const assert = require('assert');

const Connector = require('../Connector');

const PAGE_SIZE = 100;

function validateHost (host) {
    assert(_.has(host, 'id'), 'id missing for host');
    assert(_.has(host, 'display_name'), 'display_name missing for host');
    assert(_.has(host, 'hostname'), 'hostname missing for host');
}

function validate (result) {
    _.values(result).forEach(validateHost);
    return result;
}

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    async getSystemDetailsBatch (ids = false) {
        if (ids.length === 0) {
            return {};
        }

        const uri = new URI(host);
        uri.path('/r/insights/platform/inventory/api/v1/hosts');

        if (ids) {
            uri.segment(ids.join());

            // TODO: what if we need more than 100?
            uri.addQuery('per_page', String(PAGE_SIZE));
        } else {
            // this is a ping request
            uri.addQuery('per_page', String(1));
        }

        const response = await this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: {
                ...this.getForwardedHeaders()
            }
        }, true);

        const transformed = _(response.results)
        .keyBy('id')
        .mapValues(({id, display_name, fqdn: hostname}) => ({id, display_name, hostname}))
        .value();

        return validate(transformed);
    }

    async fetchPage (page) {
        const uri = new URI(host);
        uri.path('/r/insights/platform/inventory/api/v1/hosts');
        uri.addQuery('per_page', String(PAGE_SIZE));
        uri.addQuery('page', String(page));

        return await this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: {
                ...this.getForwardedHeaders()
            }
        }, false);
    }

    async getSystemsByInsightsId (id) {
        let responses = [await this.fetchPage(1)];

        if (responses[0].total > PAGE_SIZE) {
            const lastPage = Math.ceil(responses[0].total / PAGE_SIZE);
            const rest = await P.map(Array.from(Array(lastPage + 1).keys()).slice(2), i => this.fetchPage(i));
            responses = [...responses, ...rest];
        }

        const transformed = _(responses)
        .flatMap('results')
        .filter(({insights_id}) => insights_id === id)
        .map(({id, display_name, fqdn: hostname, account, updated}) => ({id, display_name, hostname, account, updated}))
        .value();

        transformed.forEach(validateHost);
        return transformed;
    }

    ping () {
        return this.getSystemDetailsBatch();
    }
}();

