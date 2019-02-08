'use strict';

const _ = require('lodash');
const P = require('bluebird');
const errors = require('../errors');
const issues = require('../issues');
const identifiers = require('../util/identifiers');
const disambiguator = require('./disambiguator');

exports.getResolutions = errors.async(async function (req, res) {
    const result = await getResolutions(req.params.issue);

    if (!result) {
        return res.status(404).end();
    }

    res.json(result);
});

exports.resolutionsBatch = errors.async(async function (req, res) {
    const { issues } = req.body;

    let result = _(issues).keyBy().mapValues(getResolutions).value();
    result = await P.props(result);
    result = _.mapValues(result, value => value || false);

    res.json(result);
});

async function getResolutions (identifier) {
    const id = identifiers.parse(identifier);
    const resolver = issues.getHandler(id).getResolutionResolver();
    const resolutions = await resolver.resolveResolutions(id);

    if (!resolutions.length) {
        return null;
    }

    return buildRepresentation(id, resolutions);
}

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
