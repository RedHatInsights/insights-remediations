'use strict';

const Handler = require('./Handler');
const errors = require('../errors');

const vmaas = require('../connectors/vmaas');
const vulnerabilities = require('../connectors/vulnerabilities');
const cveResolver = new(require('../resolutions/resolvers/CVEResolver'))();
const cveFactory = new(require('../generator/factories/CVEFactory'))();

module.exports = class CVEHandler extends Handler {

    getIssueDetailsInternal (req, id) {
        return vmaas.getCve(req, id.issue);
    }

    async getIssueDetails (id, req) {
        const raw = await this.getIssueDetailsInternal(req, id);

        if (!raw) {
            throw errors.unknownIssue(req, id);
        }

        return {
            description: id.issue,
            raw
        };
    }

    getResolutionResolver () {
        return cveResolver;
    }

    getPlayFactory (id, req) {
        return cveFactory;
    }

    getSystems (id, req) {
        return vulnerabilities.getSystems(id.issue, req);
    }
};

