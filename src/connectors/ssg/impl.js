'use strict';

const request = require('../http');
const URI = require('urijs');

const {host} = require('../../config').ssg;

exports.getTemplate = function (id) {
    const uri = new URI(host);
    uri.segment('/playbooks');
    uri.segment(`${id}.yml`);

    return request({ uri: uri.toString() }, true);
};

exports.ping = function () {
    return exports.getTemplate('sshd_disable_root_login');
};

