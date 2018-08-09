'use strict';

const config = require('../../config');
const request = require('../../util/request');
const URI = require('urijs');

exports.getErratum = function (id) {
    const uri = new URI(config.vmaas.host);
    uri.path('/api/v1/errata');
    uri.segment(id);

    return request({
        uri: uri.toString(),
        method: 'GET',
        json: true
    }).then(res => res.errata_list);
};

