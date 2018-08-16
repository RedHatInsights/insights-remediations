'use strict';

const {host, auth, insecure} = require('../../config').vulnerabilities;
const request = require('../http');
const URI = require('urijs');

exports.getRule = function (id) {
    const uri = new URI(host);
    uri.path('/r/insights/v3/rules/');
    uri.segment(id);

    return request({
        uri: uri.toString(),
        method: 'GET',
        json: true,
        rejectUnauthorized: !insecure,
        headers: {
            Authorization: auth
        }
    });
};

