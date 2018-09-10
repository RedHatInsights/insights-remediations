'use strict';

const URI = require('urijs');
const _ = require('lodash');

const config = require('../../config');
const request = require('../http');

exports.getResolutions = async function (id) {
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
};

exports.ping = function () {
    return exports.getResolutions('bond_config_issue|BOND_CONFIG_ISSUE');
};
