'use strict';

const config = require('../config');
const request = require('./http');

exports.getTemplate = function (id) {
    const uri = `${config.ssg.repository}/${id.toLowerCase()}.yml`;

    return request({
        uri,
        method: 'GET'
    });
};
