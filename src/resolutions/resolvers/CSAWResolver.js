'use strict';

const errors = require('../../errors');
const Resolver = require('./Resolver');
const identifier = require('../../util/identifiers');
const vulnerabilities = require('../../connectors/vulnerabilities');
const shared = require('./SharedFunctions');

module.exports = class CVEResolver extends Resolver {

    async resolveResolutions (id) {
        const ids = identifier.parseCSAW(id);

        id.issue = ids.csaw;
        const templates = await vulnerabilities.getResolutions(id.issue);

        if (!templates) {
            if (ids.cve) {
                id.issue = ids.cve;
                return null;
            }

            throw errors.unknownIssue(id);
        }

        return templates.map(template => shared.parseResolution(template));
    }
};
