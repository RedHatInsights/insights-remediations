'use strict';

const issues = require('../../issues');
const errors = require('../../errors');
const Factory = require('./Factory');
const ResolutionPlay = require('../plays/ResolutionPlay');
const ErratumPlay = require('../plays/ErratumPlay');
const ErratumResolution = require('../../resolutions/ErratumResolution');
const getTrace = require('../../util/trace');

module.exports = class CSAWFactory extends Factory {

    async createPlay (req, issue, strict = true) {
        getTrace(req).enter('CSAWFactory.createPlay');

        getTrace(req).event(`Resolve resolutions for id: ${issue.id}`);
        const {id, hosts, resolution} = issue;
        const resolver = issues.getHandler(id, req).getResolutionResolver();
        const resolutions = await resolver.resolveResolutions(req, id);
        getTrace(req).event(`Resolutions: ${JSON.stringify(resolutions)}`);

        if (!resolutions.length) {
            getTrace(req).leave('Unknown issue!');
            throw errors.unknownIssue(id, req);
        }

        getTrace(req).event('Disambiguate resolutions...');
        const disambiguatedResolution = this.disambiguate(resolutions, resolution, id, strict, req);
        getTrace(req).event(`Disambiguated resolution: ${JSON.stringify(disambiguatedResolution)}`);

        if (ErratumResolution.isErratumResolution(disambiguatedResolution)) {
            const result = new ErratumPlay(id, hosts, disambiguatedResolution, disambiguatedResolution.description);
            getTrace(req).event(`Returning Erratum play: ${JSON.stringify(result)}`);
            return result;
        }

        const result = new ResolutionPlay(id, hosts, disambiguatedResolution);
        getTrace(req).leave(`Returning Resolution play: ${JSON.stringify(result)}`);
        return result;
    }
};
