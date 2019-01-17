'use strict';

const request = require('../http');
const URI = require('urijs');
const Connector = require('../Connector');

const {host} = require('../../config').ssg;

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    getTemplate (id) {
        const uri = new URI(host);
        uri.segment('/playbooks');
        uri.segment(`${id}.yml`);

        return request({ uri: uri.toString() }, true);
    }

    ping () {
        return this.getTemplate('sshd_disable_root_login');
    }
}();
