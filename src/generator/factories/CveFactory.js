'use strict';

const errors = require('../../errors');
const ErratumPlay = require('../plays/ErratumPlay');
const disambiguator = require('../../resolutions/disambiguator');
const erratumResolver = require('../../resolutions/resolvers/erratumResolver');

exports.createPlay = async function ({id, hosts, resolution}) {
    const resolutions = await erratumResolver.resolveResolutions(id);

    if (!resolutions.length) {
        throw errors.unknownIssue(id);
    }

    const disambiguatedResolution = disambiguator.disambiguate(resolutions, resolution, id);
    const description = `Upgrade packages affected by ${id.issue}`;
    return new ErratumPlay(id, hosts, disambiguatedResolution, description);
};
