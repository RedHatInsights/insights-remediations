'use strict';

const errors = require('../errors');
const PATTERN = /^(advisor|vulnerabilities|ssg|test|patch-advisory):([\w\d_|:\\.-]+)$/;
const SSG_PATTERN = /^([\w-]+)\|([\w-]+)\|xccdf_org\.ssgproject\.content_rule_([\w\d-_:\\.]+)$/;
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

    if (!result || result.length !== 4) {
        throw errors.invalidIssueId(id);
    }

    return {
        platform: result[1],
        profile: result[2],
        rule: result[3],
        ruleRef: `xccdf_org.ssgproject.content_rule_${result[3]}`
    };
};

exports.toExternal = id => match(id)[2];
