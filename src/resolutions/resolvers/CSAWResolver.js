'use strict';

const _ = require('lodash');
const log = require('../../util/log');
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

        log.debug(`BEFORE FIST IF: ${resolutions}`);
        if (!resolutions) {
            log.debug(`BEFORE CVE: ${parsed.cve}`);
            if (!_.isUndefined(parsed.cve)) {
                log.debug(`AFTER CHECK BEFORE CALL: ${parsed.cve}`);
                id.issue = parsed.cve;
                return await cveResolver.resolveResolutions(id);
            }

            return [];
        }

        return resolutions.map(resolution => shared.parseResolution(resolution));
    }
};
