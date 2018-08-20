'use strict';

exports.getRule = async function (id) {
    return {
        id,
        description: `OpenSCAP fix for ${id}`
    };
};

exports.ping = function () {
    return exports.getRule('sshd_disable_root_login');
};

