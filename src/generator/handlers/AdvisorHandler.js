'use strict';

const P = require('bluebird');
const ResolutionPlay = require('../ResolutionPlay');
const advisor = require('../../connectors/advisor');
const disambiguator = require('../../resolutions/disambiguator');
const contentServerResolver = require('../../resolutions/resolvers/contentServerResolver');

exports.application = 'advisor';

exports.createPlay = async function ({id, resolution, hosts}) {
    const [resolutions, rule] = await P.all([
        contentServerResolver.resolveResolutions(id),
        advisor.getRule(id.issue)
    ]);

    if (!resolutions.length || !rule) {
        return;
    }

    const disambiguatedResolution = disambiguator.disambiguate(resolutions, resolution, id);
    return new ResolutionPlay(id, hosts, disambiguatedResolution, rule.description);
};

