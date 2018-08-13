'use strict';

const P = require('bluebird');
const ResolutionPlay = require('../plays/ResolutionPlay');
const compliance = require('../../connectors/compliance');
const ssgResolver = require('../../resolutions/resolvers/ssgResolver');

exports.application = 'compliance';

exports.createPlay = async function ({id, hosts}) {
    const [template, rule] = await P.all([
        ssgResolver.resolveResolution(id),
        compliance.getRule(id.issue)
    ]);

    if (!template || !rule) {
        return;
    }

    return new ResolutionPlay(id, hosts, template, rule.description);
};

