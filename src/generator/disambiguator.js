'use strict';

const _ = require('lodash');
const errors = require('../errors');

exports.disambiguate = function (templates, resolution, id) {
    if (!templates.length) {
        return;
    }

    if (templates.length === 1) {
        return templates[0];
    }

    if (resolution) {
        const found = _.find(templates, {resolutionType: resolution});

        if (found) {
            return found;
        }

        throw new errors.BadRequest('UNKNOWN_RESOLUTION',
            `Issue "${id.full}" does not have Ansible resolution "${resolution}"`);
    }

    const fix = _.find(templates, {resolutionType: 'fix'});
    if (fix) {
        return fix;
    }

    return _.sortBy(templates, 'resolutionType')[0];
};
