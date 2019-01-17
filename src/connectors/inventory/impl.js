'use strict';

const _ = require('lodash');
const request = require('../http');
const URI = require('urijs');
const {host, insecure} = require('../../config').inventory;
const { IDENTITY_HEADER } = require('../../middleware/identity/utils');
const cls = require('../../util/cls');
const assert = require('assert');

const Connector = require('../Connector');

function validate (result) {
    _.values(result).forEach(host => {
        assert(_.has(host, 'id'), 'id missing for host');
        assert(_.has(host, 'display_name'), 'display_name missing for host');
        assert(_.has(host, 'hostname'), 'hostname missing for host');
    });

    return result;
}

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    async getSystemDetailsBatch (ids = false) {
        const uri = new URI(host);
        uri.path('/r/insights/platform/inventory/api/v1/hosts');

        if (ids) {
            uri.segment(ids.join());

            // TODO: what if we need more than 100?
            uri.addQuery('per_page', String(100));
        } else {
            // this is a ping request
            uri.addQuery('per_page', String(1));
        }

        const req = cls.getReq();
        assert(req, 'request not available in CLS');
        const identity = req.headers[IDENTITY_HEADER];
        assert(req, 'identity header not available for outbound inventory request');

        const response = await request({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: {
                [IDENTITY_HEADER]: identity
            }
        }, true);

        const transformed = _(response.results)
        .keyBy('id')
        .mapValues(({id, display_name, fqdn: hostname}) => ({id, display_name, hostname}))
        .value();

        return validate(transformed);
    }

    ping () {
        return this.getSystemDetailsBatch();
    }
}();

