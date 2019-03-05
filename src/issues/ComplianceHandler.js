'use strict';

const Handler = require('./Handler');
const errors = require('../errors');

const compliance = require('../connectors/compliance');
const complianceFactory = new(require('../generator/factories/ComplianceFactory'))();
const cacResolver = new(require('../resolutions/resolvers/CACResolver'))();

module.exports = class ComplianceHandler extends Handler {
    async getIssueDetails (id) {
        const raw = await compliance.getRule(id.issue);

        if (!raw) {
            throw errors.unknownIssue(id);
        }

        return {
            description: raw.title,
            raw
        };
    }

    getResolutionResolver () {
        return cacResolver;
    }

    getPlayFactory () {
        return complianceFactory;
    }
};
