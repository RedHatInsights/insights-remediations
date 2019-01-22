'use strict';

const config = require('../../config');
const Connector = require('../Connector');

module.exports = new class extends Connector {
    constructor () {
        super(module);
    }

    getTemplate (id) {
        const uri = `${config.ssg.repository}/${id.toLowerCase()}.yml`;

        return this.doHttp({
            uri,
            method: 'GET'
        }, true);
    }

    ping () {
        return this.getTemplate('sshd_disable_root_login');
    }
}();
