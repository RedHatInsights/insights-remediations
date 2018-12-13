'use strict';

const request = require('../http');
const URI = require('urijs');
const {host, insecure} = require('../../config').compliance;
const { IDENTITY_HEADER } = require('../../middleware/identity/utils');
const cls = require('../../util/cls');
const assert = require('assert');

exports.getRule = function (id) {
    id = id.replace('.', '-'); // compliance API limitation

    const uri = new URI(host);
    uri.path('/r/insights/platform/compliance/rules/');
    uri.segment(id);

    const req = cls.getReq();
    assert(req, 'request not available in CLS');
    const identity = req.headers[IDENTITY_HEADER];
    assert(req, 'identity header not available for outbound compliance request');

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
    return exports.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login');
};
