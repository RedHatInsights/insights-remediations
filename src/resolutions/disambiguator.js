'use strict';

const _ = require('lodash');
const errors = require('../errors');

exports.disambiguate = function (templates, resolution, id) {
    if (!templates.length) {
        return;
    }

    if (templates.length === 1 && !resolution) {
        return templates[0];
    }

    if (resolution) {
        const found = _.find(templates, {type: resolution});

        if (found) {
            return found;
        }

        throw errors.unknownResolution(id, resolution);
    }

    const fix = _.find(templates, {type: 'fix'});
    if (fix) {
        return fix;
    }

    return _.sortBy(templates, 'type')[0];
};
