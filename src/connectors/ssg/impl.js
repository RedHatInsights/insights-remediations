'use strict';

const URI = require('urijs');
const Connector = require('../Connector');
const metrics = require('../metrics');
const assert = require('assert');

const {host} = require('../../config').ssg;
const VERSION_HEADER = 'x-ssg-version';

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.metrics = metrics.createConnectorMetric(this.getName());
    }

    getTemplate (platform, profile, rule) {
        const uri = new URI(host);
        uri.segment('/playbooks');
        uri.segment(platform);
        uri.segment('/playbooks');
        uri.segment(profile);
        uri.segment(`${rule}.yml`);

        return this.doHttp(
            { uri: uri.toString() },
            false,
            this.metrics,
            // eslint-disable-next-line security/detect-object-injection
            res => res === null ? null : ({template: res.body, version: res.headers[VERSION_HEADER]})
        );
    }

    async ping () {
        const result = await this.getTemplate('ssg:rhel7|pci-dss|xccdf_org.ssgproject.content_rule_file_owner_etc_passwd');
        assert(result !== null);
    }
}();
