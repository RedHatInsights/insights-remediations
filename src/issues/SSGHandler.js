'use strict';

const Handler = require('./Handler');
const errors = require('../errors');

const compliance = require('../connectors/compliance');
const complianceFactory = new(require('../generator/factories/ComplianceFactory'))();
const resolver = new(require('../resolutions/resolvers/SSGResolver'))();
const identifiers = require('../util/identifiers');

module.exports = class ComplianceHandler extends Handler {
    async getIssueDetails (id) {
        const ssgId = identifiers.parseSSG(id);
    
        // Build SCAP Security Guide link for the rule
        // Example: https://static.open-scap.org/ssg-guides/ssg-rhel8-guide-cis_server_l1.html#rule_selinux_policytype
        const platform = ssgId.platform; // e.g., rhel7, rhel8
        const profile = ssgId.profile;   // e.g., pci-dss, standard, ospp, cis_server_l1
        const ruleRef = ssgId.ruleRef;         // e.g., xccdf_org.ssgproject.content_rule_partition_for_tmp

        const scapUrl = `https://static.open-scap.org/ssg-guides/ssg-${platform}-guide-${profile}.html#${ruleRef}`;
        const description = `To learn more about this rule: ${scapUrl}`

        return { description };
    }

    getResolutionResolver () {
        return resolver;
    }

    getPlayFactory () {
        return complianceFactory;
    }
};
