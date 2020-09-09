'use strict';

const issues = require('../../issues');
const errors = require('../../errors');
const Factory = require('./Factory');
const ResolutionPlay = require('../plays/ResolutionPlay');
const cveFactory = new(require('./CVEFactory'))();

module.exports = class CVEFactory extends Factory {

    async createPlay (issue, strict = true) {
        const {id, hosts, resolution} = issue;
        const resolver = issues.getHandler(id).getResolutionResolver();
        const resolutions = await resolver.resolveResolutions(id, strict);

        if (!resolutions) {
            const cvePlay = cveFactory.createPlay(issue, strict);
            if (!cvePlay) {
                throw errors.unknownIssue(id);
            }

            return cvePlay;
        }

        const disambiguatedResolution = this.disambiguate(resolutions, resolution, id, strict);
        return new ResolutionPlay(id, hosts, disambiguatedResolution);
    }
};
