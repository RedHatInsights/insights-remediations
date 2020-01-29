'use strict';

const Handler = require('./Handler');
const errors = require('../errors');

const testResolver = new(require('../resolutions/resolvers/TestResolver'))();
const testFactory = new(require('../generator/factories/TestFactory'))();

module.exports = class TestHandler extends Handler {

    async getIssueDetails (id) {
        const [resolution] = await testResolver.resolveResolutions(id);
        if (!resolution) {
            throw errors.unknownIssue(id);
        }

        return {
            description: resolution.description
        };
    }

    getPlayFactory () {
        return testFactory;
    }

    getResolutionResolver () {
        return testResolver;
    }
};
