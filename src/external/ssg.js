'use strict';

const config = require('../config');
const request = require('../util/request');

exports.getTemplate = function (id) {
    const uri = `${config.ssg.repository}/${id.toLowerCase()}.yml`;

    return request({
        uri,
        method: 'GET'
    });
};
