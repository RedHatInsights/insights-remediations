'use strict';

const Handler = require('./Handler');
const errors = require('../errors');
const vmaas = require('../connectors/vmaas');
const identifiers = require('../util/identifiers');
const vulnerabilities = require('../connectors/vulnerabilities');
const csawResolver = new(require('../resolutions/resolvers/CSAWResolver'))();
const csawFactory = new(require('../generator/factories/CSAWFactory'))();

module.exports = class CVEHandler extends Handler {

    getCSAWIssueDetailsInternal (id, req) {
        return vulnerabilities.getResolutions(req, id.issue);
    }

    getCVEIssueDetailsInternal (req, id) {
        return vmaas.getCve(req, id.issue);
    }

    async getIssueDetails (id, req) {
        const parsed = identifiers.parseCSAW(req, id);
        id.issue = parsed.csaw;

        let raw = await this.getCSAWIssueDetailsInternal(id, req);

        if (!raw && parsed.cve) {
            id.issue = parsed.cve;
            raw = await this.getCVEIssueDetailsInternal(req, id);
        }

        if (!raw) {
            throw errors.unknownIssue(req, id);
        }

        return {
            description: id.issue,
            raw
        };
    }

    getResolutionResolver () {
        return csawResolver;
    }

    getPlayFactory (id, req) {
        return csawFactory;
    }
};
