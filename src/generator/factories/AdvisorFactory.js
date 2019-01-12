'use strict';

const P = require('bluebird');
const issues = require('../../issues');
const errors = require('../../errors');
const ResolutionPlay = require('../plays/ResolutionPlay');
const disambiguator = require('../../resolutions/disambiguator');

exports.createPlay = async function ({id, resolution, hosts}) {
    const handler = issues.getHandler(id);

    const [resolutions, rule] = await P.all([
        handler.getResolutionResolver().resolveResolutions(id),
        handler.getIssueDetails(id)
    ]);

    if (!resolutions.length) {
        throw errors.unsupportedIssue(id);
    }

    const disambiguatedResolution = disambiguator.disambiguate(resolutions, resolution, id);
    return new ResolutionPlay(id, hosts, disambiguatedResolution, rule.description);
};
