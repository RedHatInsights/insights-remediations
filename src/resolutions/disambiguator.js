'use strict';

const _ = require('lodash');
const errors = require('../errors');

exports.disambiguate = function (templates, resolution, id, strict = true) {
    if (!templates.length) {
        return;
    }

    if (templates.length === 1 && !resolution) {
        return templates[0];
    }

    if (resolution && resolution.length) {
        const found = _.find(templates, {type: resolution});

        if (found) {
            return found;
        }

        if (strict) {
            throw errors.unknownResolution(id, resolution);
        }
    }

    const fix = _.find(templates, {type: 'fix'});
    if (fix) {
        return fix;
    }

    return _.sortBy(templates, 'type')[0];
};

exports.sort = function (resolutions) {
    return _.sortBy(resolutions, resolution => resolution.type === 'fix' ? 0 : 1, 'resolution_type');
};
