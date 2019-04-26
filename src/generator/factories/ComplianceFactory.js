'use strict';

const P = require('bluebird');
const issues = require('../../issues');
const ResolutionPlay = require('../plays/ResolutionPlay');
const Factory = require('./Factory');

module.exports = class ComplianceFactory extends Factory {

    async createPlay ({id, hosts, resolution}, strict = true) {
        const handler = issues.getHandler(id);

        const [resolutions, rule] = await P.all([
            handler.getResolutionResolver().resolveResolutions(id),
            handler.getIssueDetails(id)
        ]);

        const disambiguatedResolution = this.disambiguate(resolutions, resolution, id, strict);
        return new ResolutionPlay(id, hosts, disambiguatedResolution, rule.description);
    }
};

