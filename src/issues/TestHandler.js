'use strict';

const Handler = require('./Handler');
const errors = require('../errors');

const testResolver = new(require('../resolutions/resolvers/TestResolver'))();
const testFactory = new(require('../generator/factories/TestFactory'))();

module.exports = class TestHandler extends Handler {

    async getIssueDetails (id, req) {
        const [resolution] = await testResolver.resolveResolutions(req, id);
        if (!resolution) {
            throw errors.unknownIssue(req, id);
        }

        return {
            description: resolution.description
        };
    }

    getPlayFactory (id, req) {
        return testFactory;
    }

    getResolutionResolver () {
        return testResolver;
    }
};
