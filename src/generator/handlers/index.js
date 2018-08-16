'use strict';

const _ = require('lodash');
const errors = require('../../errors');
const config = require('../../config');

const HANDLERS = _([
    require('./AdvisorHandler'),
    require('./ComplianceHandler'),
    require('./VulnerabilityHandler'),
    require('./TestHandler')
]).keyBy(handler => handler.application)
.pickBy((value, key) => config.env !== 'production' || key !== 'test') // disable test handler in prod
.value();

function pickHandler(id) {
    if (id.app in HANDLERS) {
        return HANDLERS[id.app];
    }

    throw errors.unknownIssue(id);
}

exports.createPlay = async function (issue) {
    return pickHandler(issue.id).createPlay(issue);
};

exports.getResolver = function (id) {
    return pickHandler(id).getResolver(id);
};
