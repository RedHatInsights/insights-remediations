'use strict';

const URI = require('urijs');
const {host, insecure} = require('../../config').compliance;

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

        return this.doHttp({
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: {
                ...this.getForwardedHeaders()
            }
        }, true);
    }

    ping () {
        return this.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login');
    }
}();

