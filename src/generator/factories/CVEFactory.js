'use strict';

const getTrace = require('../../util/trace');
const issues = require('../../issues');
const errors = require('../../errors');
const ErratumPlay = require('../plays/ErratumPlay');
const Factory = require('./Factory');

module.exports = class CVEFactory extends Factory {

    async createPlay (req, {id, hosts, resolution}, strict = true) {
        getTrace(req).enter('CVEFactory.createPlay');

        getTrace(req).event(`Resolve resolutions for issue: ${id}`);
        const resolver = issues.getHandler(id, req).getResolutionResolver();
        const resolutions = await resolver.resolveResolutions(req, id);

        if (!resolutions.length) {
            getTrace(req).event('Issue/resolution not found!');
            throw errors.unknownIssue(id, req);
        }

        getTrace(req).event(`Disambiguate resolution...`);
        const disambiguatedResolution = this.disambiguate(resolutions, resolution, id, strict, req);
        getTrace(req).event(`Disambiguated resolution.`);

        getTrace(req).event('Create erratum play...');
        const result = new ErratumPlay(id, hosts, disambiguatedResolution, disambiguatedResolution.description);

        getTrace(req).leave();
        return result;
    }
};
