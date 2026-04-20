'use strict';

const _ = require('lodash');
const Resolver = require('./Resolver');
const identifier = require('../../util/identifiers');
const vulnerabilities = require('../../connectors/vulnerabilities');
const cveResolver = new(require('./CVEResolver'))();
const shared = require('./SharedFunctions');
const getTrace = require('../../util/trace');

module.exports = class CSAWResolver extends Resolver {

    async resolveResolutions (req, id) {
        getTrace(req).enter('CSAWResolver.resolveResolutions');

        const parsed = identifier.parseCSAW(id, req);
        getTrace(req).event(`Fetch vulnerabilities resolutions for id: ${parsed.csaw}`);
        id.issue = parsed.csaw;
        const resolutions = await vulnerabilities.getResolutions(req, id.issue);
        getTrace(req).event(`Resolutions: ${JSON.stringify(resolutions)}`);

        if (_.isEmpty(resolutions)) {
            if (!_.isUndefined(parsed.cve)) {
                id.issue = parsed.cve;
                getTrace(req).event(`Fetch CVE resolution for id: ${parsed.cve}`);
                const result = await cveResolver.resolveResolutions(req, id);
                getTrace(req).leave(`Returning CVE resolution: ${JSON.stringify(result)}`);
                return result;
            }

            return [];
        }

        const result = resolutions.map(resolution => shared.parseResolution(resolution));
        getTrace(req).leave(`Returning: ${JSON.stringify(result)}`);
        return result;
    }
};
