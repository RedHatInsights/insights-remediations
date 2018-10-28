'use strict';

const issues = require('../issues');
const identifiers = require('../util/identifiers');
const disambiguator = require('./disambiguator');

exports.resolveResolution = async function (issueId, resolutionId) {
    const id = identifiers.parse(issueId);
    const playFactory = issues.getPlayFactory(id);
    const resolver = playFactory.getResolver(id);
    const resolutions = await resolver.resolveResolutions(id);
    const resolution = disambiguator.disambiguate(resolutions, resolutionId, issueId);

    if (!resolution) {
        throw new Error(); // TODO
    }

    return resolution;
};
