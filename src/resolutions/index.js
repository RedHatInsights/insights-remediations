'use strict';

const issues = require('../issues');
const identifiers = require('../util/identifiers');
const disambiguator = require('./disambiguator');
const errors = require('../errors');

exports.resolveResolution = async function (issueId, resolutionId) {
    const id = identifiers.parse(issueId);
    const playFactory = issues.getPlayFactory(id);
    const resolver = playFactory.getResolver(id);
    const resolutions = await resolver.resolveResolutions(id);
    const resolution = disambiguator.disambiguate(resolutions, resolutionId, id);

    if (!resolution) {
        throw errors.unsupportedIssue(id);
    }

    return {
        resolution,
        resolutionsAvailable: resolutions
    };
};
