'use strict';

const URI = require('urijs');
const Connector = require('../Connector');
const metrics = require('../metrics');
const assert = require('assert');

const {host} = require('../../config').cac;

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.metrics = metrics.createConnectorMetric(this.getName());
    }

    getTemplate (id) {
        const uri = new URI(host);
        uri.segment('/playbooks');
        uri.segment(`${id}.yml`);

        return this.doHttp({ uri: uri.toString() }, false, this.metrics);
    }

    async ping () {
        const result = await this.getTemplate('sshd_disable_root_login');
        assert(result !== null);
    }
}();
