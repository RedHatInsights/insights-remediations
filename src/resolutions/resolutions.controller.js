'use strict';

const _ = require('lodash');
const errors = require('../errors');
const issues = require('../issues');
const identifiers = require('../util/identifiers');
const disambiguator = require('./disambiguator');

exports.getResolutions = errors.async(async function (req, res) {
    const id = identifiers.parse(req.swagger.params.issue.value);
    const handler = issues.getHandler(id);
    const resolver = handler.getResolutionResolver();
    const resolutions = await resolver.resolveResolutions(id);

    if (!resolutions.length) {
        return res.status(404).end(); // TODO util
    }

    res.json(buildRepresentation(id, resolutions));
});

function buildRepresentation (id, availableResolutions) {
    availableResolutions = disambiguator.sort(availableResolutions);
    const resolutions = availableResolutions.map(({description, type, needsReboot, resolutionRisk}) => ({
        description,
        id: type,
        needs_reboot: needsReboot,
        resolution_risk: resolutionRisk
    }));

    return {
        id: id.full,
        resolution_risk: _.minBy(resolutions, 'resolution_risk').resolution_risk,
        resolutions
    };
}
