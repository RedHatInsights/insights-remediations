'use strict';

const URI = require('urijs');
const Connector = require('../Connector');
const metrics = require('../metrics');
const assert = require('assert');
const identifiers = require('../../util/identifiers');

const {host} = require('../../config').ssg;

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.metrics = metrics.createConnectorMetric(this.getName());
    }

    getTemplate (id) {
        const {platform, profile, rule} = identifiers.parseSSG(id);
        const uri = new URI(host);
        uri.segment('/playbooks');
        uri.segment(platform);
        uri.segment('/playbooks');
        uri.segment(profile);
        uri.segment(`${rule}.yml`);

        return this.doHttp({ uri: uri.toString() }, false, this.metrics);
    }

    async ping () {
        const result = await this.getTemplate('rhel7|pci-dss|xccdf_org.ssgproject.content_rule_file_owner_etc_passwd');
        assert(result !== null);
    }
}();
