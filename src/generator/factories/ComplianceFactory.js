'use strict';

const P = require('bluebird');
const issues = require('../../issues');
const ResolutionPlay = require('../plays/ResolutionPlay');
const Factory = require('./Factory');

module.exports = class ComplianceFactory extends Factory {

    async createPlay ({id, hosts, resolution}, req, strict = true) {
        const handler = issues.getHandler(id, req);

        const [resolutions, rule] = await P.all([
            handler.getResolutionResolver().resolveResolutions(req, id),
            handler.getIssueDetails(id, req)
        ]);
        const disambiguatedResolution = this.disambiguate(req, resolutions, resolution, id, strict);
        return new ResolutionPlay(id, hosts, disambiguatedResolution, rule.description);
    }
};

