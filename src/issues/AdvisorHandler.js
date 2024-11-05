'use strict';

const errors = require('../errors');

const Handler = require('./Handler');
const advisor = require('../connectors/advisor');
const advisorFactory = new(require('../generator/factories/AdvisorFactory'))();
const contentServerResolver = new(require('../resolutions/resolvers/ContentServerResolver'))();

module.exports = class AdvisorHandler extends Handler {

    async getIssueDetails (id, req) {
        const raw = await advisor.getRule(req, id.issue);

        if (!raw) {
            throw errors.unknownIssue(req, id);
        }

        return {
            description: raw.description,
            raw
        };
    }

    getResolutionResolver () {
        return contentServerResolver;
    }

    getPlayFactory (id, req) {
        return advisorFactory;
    }

    getSystems (id, req) {
        return advisor.getSystems(id.issue, req);
    }
};
