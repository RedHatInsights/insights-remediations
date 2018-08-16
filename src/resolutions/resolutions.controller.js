'use strict';

const _ = require('lodash');
const errors = require('../errors');
const handlers = require('../generator/handlers');
const identifiers = require('../util/identifiers');
const disambiguator = require('./disambiguator');

exports.getResolutions = errors.async(async function (req, res) {
    const id = identifiers.parse(req.swagger.params.issue.value);
    const resolver = handlers.getResolver(id);
    const resolutions = await resolver.resolveResolutions(id);

    if (!resolutions.length) {
        return res.status(404).end(); // TODO util
    }

    res.json(buildRepresentation(id, resolutions));
});

function buildRepresentation (id, availableResolutions) {
    availableResolutions = disambiguator.sort(availableResolutions);
    const resolutions = availableResolutions.map(({description, type, needsReboot, riskOfChange}) => ({
        description,
        id: type,
        needsReboot,
        riskOfChange
    }));

    return {
        id: id.full,
        riskOfChange: _.minBy(resolutions, 'riskOfChange').riskOfChange,
        resolutions
    };
}
