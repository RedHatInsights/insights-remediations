'use strict';

const Connector = require('../Connector');
const URI = require('urijs');
const {host, insecure} = require('../../config').advisor;

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    getRule (id) {
        const uri = new URI(host);
        uri.path('/r/insights/platform/advisor/v1/rule/');
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
        return this.getRule('network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE');
    }
}();
