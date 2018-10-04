'use strict';

const handlers = require('../generator/handlers');
const identifiers = require('../util/identifiers');
const disambiguator = require('./disambiguator');

exports.resolveResolution = async function (issueId, resolutionId) {
    const id = identifiers.parse(issueId);
    const resolver = handlers.getResolver(id);
    const resolutions = await resolver.resolveResolutions(id);
    const resolution = disambiguator.disambiguate(resolutions, resolutionId, issueId);

    if (!resolution) {
        throw new Error(); // TODO
    }

    return resolution;
};
