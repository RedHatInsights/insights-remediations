'use strict';

const issues = require('../../issues');
const errors = require('../../errors');
const Factory = require('./Factory');
const ResolutionPlay = require('../plays/ResolutionPlay');
const ErratumPlay = require('../plays/ErratumPlay');
const ErratumResolution = require('../../resolutions/ErratumResolution');
const trace = require('../../util/trace');

module.exports = class CVEFactory extends Factory {

    async createPlay (issue, req, strict = true) {
        trace.enter('CSAWFactory.createPlay');

        trace.event(`Resolve resolutions for id: ${issue.id}`);
        const {id, hosts, resolution} = issue;
        const resolver = issues.getHandler(id, req).getResolutionResolver();
        const resolutions = await resolver.resolveResolutions(req, id, strict);
        trace.event(`Resolutions: ${JSON.stringify(resolutions)}`);

        if (!resolutions.length) {
            trace.leave('Unknown issue!');
            throw errors.unknownIssue(req, id);
        }

        trace.event('Disambiguate resolutions...');
        const disambiguatedResolution = this.disambiguate(req, resolutions, resolution, id, strict);
        trace.event(`Disambiguated resolution: ${JSON.stringify(disambiguatedResolution)}`);

        if (ErratumResolution.isErratumResolution(disambiguatedResolution)) {
            const result = new ErratumPlay(id, hosts, disambiguatedResolution, disambiguatedResolution.description);
            trace.event(`Returning Erratum play: ${JSON.stringify(result)}`);
            return result;
        }

        const result = new ResolutionPlay(id, hosts, disambiguatedResolution);
        trace.leave(`Returning Resolution play: ${JSON.stringify(result)}`);
        return result;
    }
};
