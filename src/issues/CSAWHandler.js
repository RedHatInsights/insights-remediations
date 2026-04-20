'use strict';

const Handler = require('./Handler');
const errors = require('../errors');
const vmaas = require('../connectors/vmaas');
const identifiers = require('../util/identifiers');
const vulnerabilities = require('../connectors/vulnerabilities');
const csawResolver = new(require('../resolutions/resolvers/CSAWResolver'))();
const csawFactory = new(require('../generator/factories/CSAWFactory'))();

module.exports = class CSAWHandler extends Handler {

    getCSAWIssueDetailsInternal (req, id) {
        return vulnerabilities.getResolutions(req, id.issue);
    }

    getCVEIssueDetailsInternal (req, id) {
        return vmaas.getCve(req, id.issue);
    }

    async getIssueDetails (req, id) {
        const parsed = identifiers.parseCSAW(id, req);
        id.issue = parsed.csaw;

        let raw = await this.getCSAWIssueDetailsInternal(req, id);

        if (!raw && parsed.cve) {
            id.issue = parsed.cve;
            raw = await this.getCVEIssueDetailsInternal(req, id);
        }

        if (!raw) {
            throw errors.unknownIssue(id, req);
        }

        return {
            description: id.issue,
            raw
        };
    }

    getResolutionResolver () {
        return csawResolver;
    }

    getPlayFactory () {
        return csawFactory;
    }
};
