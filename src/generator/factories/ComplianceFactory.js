'use strict';

const P = require('bluebird');
const errors = require('../../errors');
const ResolutionPlay = require('../plays/ResolutionPlay');
const compliance = require('../../connectors/compliance');
const ssgResolver = require('../../resolutions/resolvers/ssgResolver');
const disambiguator = require('../../resolutions/disambiguator');

exports.createPlay = async function ({id, hosts, resolution}) {
    const [resolutions, rule] = await P.all([
        ssgResolver.resolveResolutions(id),
        compliance.getRule(id.issue)
    ]);

    if (!rule) {
        throw errors.unknownIssue(id);
    }

    if (!resolutions.length) {
        throw errors.unsupportedIssue(id);
    }

    const disambiguatedResolution = disambiguator.disambiguate(resolutions, resolution, id);

    // TODO: remove duplication between getIssueDetails and getPlayFactory
    return new ResolutionPlay(id, hosts, disambiguatedResolution, rule.data.attributes.title);
};

exports.getResolver = function () {
    return ssgResolver;
};

