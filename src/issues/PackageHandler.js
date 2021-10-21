'use strict';

const Handler = require('./Handler');
const packageResolver = new(require('../resolutions/resolvers/PackageResolver'))();
const cveFactory = new(require('../generator/factories/CVEFactory'))();

module.exports = class PackageHandler extends Handler {

    async getIssueDetails (id) {
        return {
            description: id.issue
        };
    }

    getResolutionResolver () {
        return packageResolver;
    }

    getPlayFactory () {
        return cveFactory;
    }
};
