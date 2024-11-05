'use strict';

const Handler = require('./Handler');
const errors = require('../errors');

const compliance = require('../connectors/compliance');
const complianceFactory = new(require('../generator/factories/ComplianceFactory'))();
const resolver = new(require('../resolutions/resolvers/SSGResolver'))();
const identifiers = require('../util/identifiers');

module.exports = class ComplianceHandler extends Handler {
    async getIssueDetails (id, req) {
        const ssgId = identifiers.parseSSG(req, id);
        const raw = await compliance.getRule(req, ssgId.ruleRef);

        if (!raw) {
            throw errors.unknownIssue(req, id);
        }

        return {
            description: raw.title,
            raw
        };
    }

    getResolutionResolver () {
        return resolver;
    }

    getPlayFactory (id, req) {
        return complianceFactory;
    }
};
