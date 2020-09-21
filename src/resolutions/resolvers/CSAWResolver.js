'use strict';

const _ = require('lodash');
const Resolver = require('./Resolver');
const identifier = require('../../util/identifiers');
const vulnerabilities = require('../../connectors/vulnerabilities');
const cveResolver = new(require('./CVEResolver'))();
const shared = require('./SharedFunctions');

module.exports = class CVEResolver extends Resolver {

    async resolveResolutions (id) {
        const parsed = identifier.parseCSAW(id);
        id.issue = parsed.csaw;
        const resolutions = await vulnerabilities.getResolutions(id.issue);

        if (!resolutions) {
            if (!_.isUndefined(parsed.cve)) {
                id.issue = parsed.cve;
                return await cveResolver.resolveResolutions(id);
            }

            return [];
        }

        return resolutions.map(resolution => shared.parseResolution(resolution));
    }
};
