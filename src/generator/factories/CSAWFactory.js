'use strict';

const issues = require('../../issues');
const errors = require('../../errors');
const Factory = require('./Factory');
const ResolutionPlay = require('../plays/ResolutionPlay');
const ErratumPlay = require('../plays/ErratumPlay');
const ErratumResolution = require('../../resolutions/ErratumResolution');

module.exports = class CVEFactory extends Factory {

    async createPlay (issue, strict = true) {
        const {id, hosts, resolution} = issue;
        const resolver = issues.getHandler(id).getResolutionResolver();
        const resolutions = await resolver.resolveResolutions(id, strict);

        if (!resolutions.length) {
            throw errors.unknownIssue(id);
        }

        const disambiguatedResolution = this.disambiguate(resolutions, resolution, id, strict);
        if (ErratumResolution.isErratumResolution(disambiguatedResolution)) {
            return new ErratumPlay(id, hosts, disambiguatedResolution, disambiguatedResolution.description);
        }

        return new ResolutionPlay(id, hosts, disambiguatedResolution);
    }
};
