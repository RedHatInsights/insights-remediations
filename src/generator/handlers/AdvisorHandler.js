'use strict';

const P = require('bluebird');
const errors = require('../../errors');
const ResolutionPlay = require('../plays/ResolutionPlay');
const advisor = require('../../connectors/advisor');
const disambiguator = require('../../resolutions/disambiguator');
const contentServerResolver = require('../../resolutions/resolvers/contentServerResolver');

exports.application = 'advisor';

exports.createPlay = async function ({id, resolution, hosts}) {
    const [resolutions, rule] = await P.all([
        contentServerResolver.resolveResolutions(id),
        advisor.getRule(id.issue)
    ]);

    if (!rule) {
        throw errors.unknownIssue(id);
    }

    if (!resolutions.length) {
        throw errors.unsupportedIssue(id);
    }

    const disambiguatedResolution = disambiguator.disambiguate(resolutions, resolution, id);
    return new ResolutionPlay(id, hosts, disambiguatedResolution, rule.description);
};

exports.getResolver = function () {
    return contentServerResolver;
};

