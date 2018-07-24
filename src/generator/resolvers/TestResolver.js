'use strict';

const _ = require('lodash');
const templates = require('../templates').test;

/*
 * Special handler for testing and debugging. This handler handles the 'test' namespace.
 */
exports.resolveTemplates = function (ids) {
    return Promise.resolve(_(ids)
    .keyBy()
    .mapValues(id => id.split(':'))
    .pickBy(parts => parts.length === 2 && parts[0] === 'test' && parts[1] in templates)
    .mapValues(parts => ([templates[parts[1]]]))
    .value());
};
