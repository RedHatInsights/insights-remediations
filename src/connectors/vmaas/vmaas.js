'use strict';

const config = require('../../config');
const request = require('../http');
const URI = require('urijs');

exports.getErratum = function (id) {
    const uri = new URI(config.vmaas.host);
    uri.path('/api/v1/errata');
    uri.segment(id);

    return request({
        uri: uri.toString(),
        method: 'GET',
        json: true
    }, true).then(res => {
        if (res) {
            return res.errata_list[id];
        }

        return res;
    });
};

exports.getCve = function (id) {
    const uri = new URI(config.vmaas.host);
    uri.path('/api/v1/cves');
    uri.segment(id);

    return request({
        uri: uri.toString(),
        method: 'GET',
        json: true
    }, true).then(res => {
        if (res) {
            return res.cve_list[id];
        }

        return res;
    });
};

exports.ping = function () {
    return exports.getCve('CVE-2017-17712');
};

