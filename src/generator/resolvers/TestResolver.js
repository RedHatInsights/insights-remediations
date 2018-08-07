'use strict';

const _ = require('lodash');
const templates = require('../templates').test;
const identifiers = require('../../util/identifiers');

/*
 * Special handler for testing and debugging. This handler handles the 'test' namespace.
 */
exports.resolveTemplates = function (ids) {
    return Promise.resolve(_(ids)
    .keyBy()
    .mapValues(identifiers.parse)
    .pickBy(id => id.app === 'test' && id.issue in templates)
    .mapValues(id => ([templates[id.issue]]))
    .value());
};
