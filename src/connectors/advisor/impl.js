'use strict';

const request = require('../http');
const URI = require('urijs');
const {host, insecure} = require('../../config').advisor;
const { IDENTITY_HEADER } = require('../../middleware/identity/utils');
const cls = require('../../util/cls');
const assert = require('assert');

exports.getRule = function (id) {
    const uri = new URI(host);
    uri.path('/r/insights/platform/advisor/v1/rule/');
    uri.segment(id);

    const req = cls.getReq();
    assert(req, 'request not available in CLS');
    const identity = req.headers[IDENTITY_HEADER];
    assert(req, 'identity header not available for outbound advisor request');

    return request({
        uri: uri.toString(),
        method: 'GET',
        json: true,
        rejectUnauthorized: !insecure,
        headers: {
            [IDENTITY_HEADER]: identity
        }
    }, true);
};

exports.ping = function () {
    return exports.getRule('network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE');
};
