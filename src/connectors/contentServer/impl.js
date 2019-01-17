'use strict';

const URI = require('urijs');
const _ = require('lodash');

const config = require('../../config');
const request = require('../http');

const Connector = require('../Connector');

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    async getResolutions (id) {
        const uri = new URI(config.contentServer.host);
        uri.segment('playbooks');
        uri.segment(id);

        const options = {
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !config.contentServer.insecure
        };

        if (config.contentServer.auth) {
            options.headers = {
                Authorization: config.contentServer.auth
            };
        }

        const resolutions = await request(options, true);

        return _.map(resolutions, resolution =>
            _(resolution)
            .pick(['description', 'play', 'resolution_type', 'resolution_risk', 'version'])
            .defaults({
                resolution_risk: -1,
                version: 'unknown'
            })
            .value()
        );
    }

    ping () {
        return this.getResolutions('network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE');
    }
}();

