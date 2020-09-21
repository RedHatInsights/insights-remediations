'use strict';

const Handler = require('./Handler');
const errors = require('../errors');
const vmaas = require('../connectors/vmaas');
const identifiers = require('../util/identifiers');
const vulnerabilities = require('../connectors/vulnerabilities');
const csawResolver = new(require('../resolutions/resolvers/CSAWResolver'))();
const csawFactory = new(require('../generator/factories/CSAWFactory'))();

module.exports = class CVEHandler extends Handler {

    getCSAWIssueDetailsInternal (id) {
        return vulnerabilities.getResolutions(id.issue);
    }

    getCVEIssueDetailsInternal (id) {
        return vmaas.getCve(id.issue);
    }

    async getIssueDetails (id) {
        const parsed = identifiers.parseCSAW(id);
        id.issue = parsed.csaw;

        let raw = await this.getCSAWIssueDetailsInternal(id);

        if (!raw && parsed.cve) {
            id.issue = parsed.cve;
            raw = await this.getCVEIssueDetailsInternal(id);
        }

        if (!raw) {
            throw errors.unknownIssue(id);
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
