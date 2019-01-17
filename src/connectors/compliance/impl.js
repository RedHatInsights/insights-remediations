'use strict';

const request = require('../http');
const URI = require('urijs');
const {host, insecure} = require('../../config').compliance;
const { IDENTITY_HEADER } = require('../../middleware/identity/utils');
const cls = require('../../util/cls');
const assert = require('assert');

const Connector = require('../Connector');

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    getRule (id) {
        id = id.replace(/\./g, '-'); // compliance API limitation

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
    }

    ping () {
        return this.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login');
    }
}();

