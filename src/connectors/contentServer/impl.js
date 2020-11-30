'use strict';

const URI = require('urijs');
const _ = require('lodash');
const assert = require('assert');

const {host, auth, insecure, revalidationInterval} = require('../../config').contentServer;
const Connector = require('../Connector');
const metrics = require('../metrics');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.metrics = metrics.createConnectorMetric(this.getName());
    }

    async getResolutions (id, refresh = false) {
        const uri = new URI(host);
        uri.segment('private');
        uri.segment('playbooks');
        uri.segment(id);

        const options = {
            uri: uri.toString(),
            method: 'GET',
            json: true,
            rejectUnauthorized: !insecure,
            headers: this.getForwardedHeaders(false)
        };

        if (auth) {
            options.headers = {
                Authorization: auth
            };
        }

        const resolutions = await this.doHttp(options, {
            refresh,
            revalidationInterval,
            cacheable: body => body.length > 0 // only cache responses with resolutions
        },
        this.metrics);

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

    async ping () {
        const result = await this.getResolutions('network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE', true);
        assert(result.length > 0);
    }
}();

