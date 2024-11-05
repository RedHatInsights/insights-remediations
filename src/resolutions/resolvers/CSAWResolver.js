'use strict';

const _ = require('lodash');
const Resolver = require('./Resolver');
const identifier = require('../../util/identifiers');
const vulnerabilities = require('../../connectors/vulnerabilities');
const cveResolver = new(require('./CVEResolver'))();
const shared = require('./SharedFunctions');
const trace = require('../../util/trace');

module.exports = class CVEResolver extends Resolver {

    async resolveResolutions (req, id) {
        trace.enter('CSAWResolver.resolveResolutions');

        const parsed = identifier.parseCSAW(req, id);
        trace.event(`Fetch vulnerabilities resolutions for id: ${parsed.csaw}`);
        id.issue = parsed.csaw;
        const resolutions = await vulnerabilities.getResolutions(req, id.issue);
        trace.event(`Resolutions: ${JSON.stringify(resolutions)}`);

        if (_.isEmpty(resolutions)) {
            if (!_.isUndefined(parsed.cve)) {
                id.issue = parsed.cve;
                trace.event(`Fetch CVE resolution for id: ${parsed.cve}`);
                const result = await cveResolver.resolveResolutions(req, id);
                trace.leave(`Returning CVE resolution: ${JSON.stringify(result)}`);
                return result;
            }

            return [];
        }

        const result = resolutions.map(resolution => shared.parseResolution(resolution));
        trace.leave(`Returning: ${JSON.stringify(result)}`);
        return result;
    }
};
