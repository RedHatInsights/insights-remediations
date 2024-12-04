'use strict';

const trace = require('../../util/trace');
const issues = require('../../issues');
const errors = require('../../errors');
const ErratumPlay = require('../plays/ErratumPlay');
const Factory = require('./Factory');

module.exports = class CVEFactory extends Factory {

    async createPlay ({id, hosts, resolution}, strict = true) {
        trace.enter('CVEFactory.createPlay');

        trace.event(`Resolve resolutions for issue: ${id}`);
        const resolver = issues.getHandler(id).getResolutionResolver();
        const resolutions = await resolver.resolveResolutions(id);

        if (!resolutions.length) {
            trace.event('Issue/resolution not found!');
            throw errors.unknownIssue(id);
        }

        trace.event(`Disambiguate resolution...`);
        const disambiguatedResolution = this.disambiguate(resolutions, resolution, id, strict);
        trace.event(`Disambiguated resolution.`);

        trace.event('Create erratum play...');
        const result = new ErratumPlay(id, hosts, disambiguatedResolution, disambiguatedResolution.description);

        trace.leave();
        return result;
    }
};
