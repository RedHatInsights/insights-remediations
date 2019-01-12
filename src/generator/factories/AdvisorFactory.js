'use strict';

const P = require('bluebird');
const issues = require('../../issues');
const ResolutionPlay = require('../plays/ResolutionPlay');

const Factory = require('./Factory');

module.exports = class AdvisorFactory extends Factory {

    async createPlay ({id, resolution, hosts}) {
        const handler = issues.getHandler(id);

        const [resolutions, rule] = await P.all([
            handler.getResolutionResolver().resolveResolutions(id),
            handler.getIssueDetails(id)
        ]);

        const disambiguatedResolution = this.disambiguate(resolutions, resolution, id);
        return new ResolutionPlay(id, hosts, disambiguatedResolution, rule.description);
    }
};

