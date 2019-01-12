'use strict';

const issues = require('../../issues');
const errors = require('../../errors');
const ErratumPlay = require('../plays/ErratumPlay');
const Factory = require('./Factory');

module.exports = class CVEFactory extends Factory {

    async createPlay ({id, hosts, resolution}) {
        const resolver = issues.getHandler(id).getResolutionResolver();
        const resolutions = await resolver.resolveResolutions(id);

        if (!resolutions.length) {
            throw errors.unknownIssue(id);
        }

        const disambiguatedResolution = this.disambiguate(resolutions, resolution, id);
        return new ErratumPlay(id, hosts, disambiguatedResolution, disambiguatedResolution.description);
    }
};
