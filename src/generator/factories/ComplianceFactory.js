'use strict';

const P = require('bluebird');
const issues = require('../../issues');
const ResolutionPlay = require('../plays/ResolutionPlay');
const Factory = require('./Factory');

module.exports = class ComplianceFactory extends Factory {

    async createPlay (req, {id, hosts, resolution}, strict = true) {
        const handler = issues.getHandler(id, req);

        const [resolutions, { description }] = await P.all([
            handler.getResolutionResolver().resolveResolutions(req, id),
            handler.getIssueDetails(req, id)
        ]);

        const disambiguatedResolution = this.disambiguate(resolutions, resolution, id, strict, req);
        return new ResolutionPlay(id, hosts, disambiguatedResolution, description);
    }
};
