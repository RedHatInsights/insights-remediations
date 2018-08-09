'use strict';

const _ = require('lodash');
const errors = require('../../errors');

const HANDLERS = _([
    require('./AdvisorHandler'),
    require('./ComplianceHandler'),
    require('./VulnerabilityHandler'),
    require('./TestHandler')
]).keyBy(handler => handler.application).value();

exports.createPlay = async function (issue) {
    if (issue.id.app in HANDLERS) {
        const play = await HANDLERS[issue.id.app].createPlay(issue);

        if (play) {
            return play;
        }
    }

    throw new errors.BadRequest('UNSUPPORTED_ISSUE', `Issue "${issue.id.full}" does not have Ansible support`);
};
