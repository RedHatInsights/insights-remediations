'use strict';

const config = require('../../config');
const request = require('../../util/request');
const uri = `${config.vmaas.host}/api/v1/errata`;

exports.getErrata = function (ids) {
    return request({
        uri,
        method: 'POST',
        json: true,
        body: {
            errata_list: ids
        }
    }).then(res => res.errata_list);
};
