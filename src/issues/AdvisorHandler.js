'use strict';

const errors = require('../errors');

const Handler = require('./Handler');
const advisor = require('../connectors/advisor');
const advisorFactory = new(require('../generator/factories/AdvisorFactory'))();
const contentServerResolver = new(require('../resolutions/resolvers/ContentServerResolver'))();

module.exports = class AdvisorHandler extends Handler {

    async getIssueDetails (id) {
        const raw = await advisor.getRule(id.issue);

        if (!raw) {
            throw errors.unknownIssue(id);
        }

        return {
            description: raw.description,
            raw
        };
    }

    getResolutionResolver () {
        return contentServerResolver;
    }

    getPlayFactory () {
        return advisorFactory;
    }

    getSystems (id) {
        return advisor.getSystems(id.issue);
    }
};
