'use strict';

const URI = require('urijs');
const Connector = require('../Connector');
const StatusCodeError = require('../StatusCodeError');
const metrics = require('../metrics');
const assert = require('assert');
const getTrace = require('../../util/trace');

const {host, revalidationInterval } = require('../../config').ssg;
const VERSION_HEADER = 'x-ssg-version';

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.metrics = metrics.createConnectorMetric(this.getName());
    }

    async getTemplate (req, platform, profile, rule) {
        getTrace(req).enter('ssg_impl.getTemplate');
        const uri = new URI(host);
        uri.segment('/playbooks');
        uri.segment(platform);
        uri.segment('/playbooks');
        uri.segment(profile);
        uri.segment(`${rule}.yml`);

        getTrace(req).event(`Fetching: ${platform}|${profile}|${rule}`);

        let result;
        try {
            result = await this.doHttp(
                { uri: uri.toString() },
                {
                    key: `remediations|http-cache|ssg|${uri.path()}`,
                    revalidationInterval
                },
                this.metrics,
                // eslint-disable-next-line security/detect-object-injection
                res => ({template: res.body, version: res.headers[VERSION_HEADER]}),
                req);
        } catch (e) {
            if (e instanceof StatusCodeError && e.statusCode === 404) {
                getTrace(req).leave();
                return null;
            }

            throw e;
        }

        getTrace(req).leave();

        return result;
    }

    async ping () {
        const result = await this.getTemplate(null, 'rhel7', 'pci-dss', 'file_owner_etc_passwd');
        assert(result !== null);
    }
}();
