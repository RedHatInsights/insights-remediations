'use strict';

const Handler = require('./Handler');
const errors = require('../errors');

const vmaas = require('../connectors/vmaas');
const cveResolver = new(require('../resolutions/resolvers/CVEResolver'))();
const cveFactory = new(require('../generator/factories/CVEFactory'))();

module.exports = class CVEHandler extends Handler {

    getIssueDetailsInternal (id) {
        return vmaas.getCve(id.issue);
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
        return cveResolver;
    }

    getPlayFactory () {
        return cveFactory;
    }
};

