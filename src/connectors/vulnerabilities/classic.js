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

exports.ping = function () {
    return exports.getRule('CVE_2017_6074_kernel|KERNEL_CVE_2017_6074');
};

