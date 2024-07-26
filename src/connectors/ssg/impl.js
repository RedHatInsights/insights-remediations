'use strict';

const URI = require('urijs');
const Connector = require('../Connector');
const metrics = require('../metrics');
const assert = require('assert');
const trace = require('../../util/trace');

const {host, revalidationInterval } = require('../../config').ssg;
const VERSION_HEADER = 'x-ssg-version';

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.metrics = metrics.createConnectorMetric(this.getName());
    }

    getTemplate (platform, profile, rule) {
        trace.enter('ssg_impl.getTemplate');
        const uri = new URI(host);
        uri.segment('/playbooks');
        uri.segment(platform);
        uri.segment('/playbooks');
        uri.segment(profile);
        uri.segment(`${rule}.yml`);

        trace.event(`Fetching: ${platform}|${profile}|${rule}`);

        const result = this.doHttp(
            { uri: uri.toString() },
            {
                key: `remediations|http-cache|ssg|${uri.path()}`,
                revalidationInterval
            },
            this.metrics,
            // eslint-disable-next-line security/detect-object-injection
            res => res === null ? null : ({template: res.body, version: res.headers[VERSION_HEADER]})
        );

        trace.leave();

        return result;
    }

    async ping () {
        const result = await this.getTemplate('rhel7', 'pci-dss', 'file_owner_etc_passwd');
        assert(result !== null);
    }
}();
