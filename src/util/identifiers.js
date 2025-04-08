'use strict';

const errors = require('../errors');

/*
Examples of possible identifiers: 
Advisor:
    - advisor:CVE_2017_6074_kernel|KERNEL_CVE_2017_6074
Vulnerability:
    - vulnerabilities:CVE-2017-17712
Compliance:
    - (API v1) ssg:rhel7|standard|xccdf_org.ssgproject.content_rule_service_autofs_disabled
    - (API v2) ssg:xccdf_org.ssgproject.content_benchmark_RHEL-8|0.0.1|cis_server_l1|xccdf_org.ssgproject.content_rule_selinux_policytype
Test:
    - test:ping
Patch:
    - patch-advisory:RHBA-2019:4105
    - patch-package:rpm-4.14.2-37.el8.x86_64
*/
const PATTERN = /^(advisor|vulnerabilities|ssg|test|patch-advisory|patch-package):([\w\d_|:\\.+-]+)$/;
const SSG_PATTERN = /^(?<platform>[\w.-]+)(?:\|(?<ssgVersion>\d+\.\d+\.\d+))?\|(?<profile>[\w-]+)\|xccdf_org\.ssgproject\.content_rule_(?<rule>[\w:\\.-]+)$/;
const CSAW_PATTERN = /^(CVE-20[\d]{2}-[\d]{4,}):(\w+\|[A-Z\d_]+)$/;
const CSAW_RULE_PATTERN = /^(\w+\|[A-Z\d_]+)$/;

function match (id) {
    const match = PATTERN.exec(id);
    if (!match) {
        throw errors.invalidIssueId(id);
    }

    return match;
}

exports.validate = match;

exports.Identifier = class Identifier {
    constructor (app, issue, full) {
        this.app = app;
        this.issue = issue;
        this.full = full;
    }

    toString () {
        return this.full;
    }
};

exports.parse = function (id) {
    const result = match(id);

    return new exports.Identifier(result[1], result[2], id);
};

exports.parseCSAW = function (id) {
    if (!(id instanceof exports.Identifier)) {
        id = exports.parse(id);
    }

    const csawResult = CSAW_PATTERN.exec(id.issue);
    const csawRuleResult = CSAW_RULE_PATTERN.exec(id.issue);

    if (!csawResult && csawRuleResult) {
        return {
            csaw: csawRuleResult[1]
        };
    } else if (csawResult && !csawRuleResult) {
        return {
            csaw: csawResult[2],
            cve: csawResult[1]
        };
    }

    throw errors.invalidIssueId(id);
};

exports.parseSSG = function (id) {
    if (!(id instanceof exports.Identifier)) {
        id = exports.parse(id);
    }

    const result = SSG_PATTERN.exec(id.issue);

    if (!result?.groups) {
        throw errors.invalidIssueId(id);
    }
    const { platform, ssgVersion, profile, rule } = result.groups;

    /* Parsed issueId for Compliance API v1 format:
      {
        platform: 'rhel7',
        ssgVersion: null,
        profile: 'standard',
        rule: 'service_autofs_disabled',
        ruleRef: 'xccdf_org.ssgproject.content_rule_service_autofs_disabled'
      }
    */

    /* Parsed issueId for Compliance API v1 format:
      {
        platform: 'xccdf_org.ssgproject.content_benchmark_RHEL-8',
        ssgVersion: '0.0.1',
        profile: 'standard',
        rule: 'service_autofs_disabled',
        ruleRef: 'xccdf_org.ssgproject.content_rule_service_autofs_disabled'
      }
    */
    return {
        platform,
        ssgVersion: ssgVersion || null,
        profile,
        rule,
        ruleRef: `xccdf_org.ssgproject.content_rule_${rule}`
    };
};

exports.toExternal = id => match(id)[2];
