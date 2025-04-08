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
        const raw = await compliance.getRule(ssgId.ruleRef, ssgId.platform, ssgId.ssgVersion);

        if (!raw) {
            throw errors.unknownIssue(id);
        }

        return {
            description: raw.title,
            raw
        };
    }

    getResolutionResolver () {
        return resolver;
    }

    getPlayFactory () {
        return complianceFactory;
    }
};
