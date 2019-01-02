'use strict';

const _ = require('lodash');
const request = require('../http');
const URI = require('urijs');
const {host, insecure} = require('../../config').inventory;
const { IDENTITY_HEADER } = require('../../middleware/identity/utils');
const cls = require('../../util/cls');
const assert = require('assert');

exports.getSystemDetailsBatch = async function (ids = []) {
    const uri = new URI(host);
    uri.path('/r/insights/platform/inventory/api/v1/hosts');

    if (ids.length) {
        uri.segment(ids.join());
    }

    // TODO: what if we need more than 100?
    uri.addQuery('per_page', String(100));

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

    return _(response.results)
    .keyBy('id')
    .mapValues(({id, display_name, fqdn: hostname}) => ({id, display_name, hostname}))
    .value();
};

exports.ping = function () {
    return exports.getSystemDetailsBatch();
};
