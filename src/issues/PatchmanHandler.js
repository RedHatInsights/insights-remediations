'use strict';

const Handler = require('./Handler');
const patchResolver = new(require('../resolutions/resolvers/PatchmanResolver'))();
const patchFactory = new(require('../generator/factories/PatchmanFactory'))();

module.exports = class PatchmanHandler extends Handler {

    async getIssueDetails (id, req) {
        return {
            description: id.issue
        };
    }

    getResolutionResolver () {
        return patchResolver;
    }

    getPlayFactory (id, req) {
        return patchFactory;
    }
};
