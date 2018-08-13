'use strict';

const P = require('bluebird');
const ResolutionPlay = require('../plays/ResolutionPlay');
const compliance = require('../../connectors/compliance');
const ssgResolver = require('../../resolutions/resolvers/ssgResolver');
const disambiguator = require('../../resolutions/disambiguator');

exports.application = 'compliance';

exports.createPlay = async function ({id, hosts, resolution}) {
    const [result, rule] = await P.all([
        ssgResolver.resolveResolution(id),
        compliance.getRule(id.issue)
    ]);

    if (!result || !rule) {
        return;
    }

    disambiguator.disambiguate([result], resolution, id);
    return new ResolutionPlay(id, hosts, result, rule.description);
};

