'use strict';

const Handler = require('./Handler');
const errors = require('../errors');

const patchman = require('../connectors/patchman');
const patchResolver = new(require('../resolutions/resolvers/PatchmanResolver'))();
const patchFactory = new(require('../generator/factories/PatchmanFactory'))();

module.exports = class PatchmanHandler extends Handler {

    getIssueDetailsInternal (id) {
        return patchman.getErratum(id.issue);
    }

    async getIssueDetails (id) {
        const raw = await this.getIssueDetailsInternal(id);

        if (!raw) {
            throw errors.unknownIssue(id);
        }

        return {
            description: id.issue,
            raw
        };
    }

    getResolutionResolver () {
        return patchResolver;
    }

    getPlayFactory () {
        return patchFactory;
    }
};

