'use strict';

const request = require('../http');
const URI = require('urijs');
const {host, insecure} = require('../../config').advisor;

exports.getRule = function (id) {
    const uri = new URI(host);
    uri.path('/r/insights/platform/advisor/v1/rule/');
    uri.segment(id);

    return request({
        uri: uri.toString(),
        method: 'GET',
        json: true,
        rejectUnauthorized: !insecure
        /*
        headers: {
            Authorization: auth
        }
        */
    }, true);
};

exports.ping = function () {
    return exports.getRule('network_bond_opts_config_issue|NETWORK_BONDING_OPTS_DOUBLE_QUOTES_ISSUE');
};
