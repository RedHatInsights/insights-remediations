'use strict';

const assert = require('assert');
const _ = require('lodash');
const log = require('../../util/log');
const {host, insecure, revalidationInterval} = require('../../config').compliance;

const Connector = require('../Connector');
const metrics = require('../metrics');

module.exports = new class extends Connector {
    constructor () {
        super(module);
        this.metrics = metrics.createConnectorMetric(this.getName());
    }

    async getRule(id, ssgRefId = null, ssgVersion = null, refresh = false, retries = 2) {
        id = id.replace(/\./g, '-'); // compliance API limitation

        for (let i = 0; i <= retries; i++) {
            try {
                let uri;

                /*
                Use Compliance API v1 if the issueId string is in this format: 
                    ssg:<major_version>|<profile>|<rule_ref_id>
                Use Compliance API v2 if the issueId string is in this format:
                    ssg:<ssg_ref_id>|<ssg_version>|<profile>|<rule_ref_id>
                */
                if (ssgVersion) {
                    // Build URI that will fetch the rule using Compliance API v2
                    uri = await this.buildV2Uri(id, ssgRefId, ssgVersion, refresh, retries);
                } else {
                    // Build URI that will fetch the rule using Compliance API v1
                    uri = this.buildUri(host, 'compliance', 'rules', id);
                }

                // Fetch the rule from Compliance
                const result = await this.doHttp({
                    uri: uri.toString(),
                    method: 'GET',
                    json: true,
                    rejectUnauthorized: !insecure,
                    headers: { ...this.getForwardedHeaders() }
                }, {
                    key: `remediations|http-cache|compliance|${host}|${id}`,
                    refresh,
                    revalidationInterval
                }, this.metrics);

                // In Compliance api v1, rule info is under data.attributes
                // In Compliance api v2, rule info is directly under data
                // Look for data.attributes first (v1) and then try to data (v2) 
                return _.get(result, 'data.attributes') || _.get(result, 'data') || null;
            } catch (error) {
                if (i === retries) throw error;
            }
        }
    }

    async buildV2Uri(id, ssgRefId, ssgVersion, refresh, retries) {
      // Build the Compliance v2 URI with the correct filters
      const ssgUri = this.buildUri(host, 'compliance', 'v2', 'security_guides');

      // Need to add the filter this way because Compliance uses scoped_search so we need to pass exactly what they expect
      ssgUri.query(`?filter=ref_id=${ssgRefId}+AND+version=${ssgVersion}`);

      // Fetch info about the scap security guide(SSG) that the rule belongs to
      const ssgResult = await this.doHttp({
        uri: ssgUri.toString(),
        method: 'GET',
        json: true,
        rejectUnauthorized: !insecure,
        headers: { ...this.getForwardedHeaders() }
      }, {
        key: `remediations|http-cache|compliance|${host}|${id}`,
        refresh,
        revalidationInterval
      }, this.metrics);

      const ssgId = _.get(ssgResult, 'data[0].id');
      if(!ssgId){
        log.warn(`No ssgId found... ssgId: ${ssgId}, ssgUri: ${ssgUri}, ssgResult: ${JSON.stringify(ssgResult, null, 2)}`);
      }

      return this.buildUri(host, 'compliance', 'v2', 'security_guides', ssgId, 'rules', id);
    }

    async ping () {
        const result = await this.getRule('xccdf_org.ssgproject.content_rule_sshd_disable_root_login', 'xccdf_org.ssgproject.content_benchmark_RHEL-8', '0.1.57', true);
        assert(result !== null);
    }
}();

