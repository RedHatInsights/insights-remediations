'use strict';

const Resolution = require('../Resolution');
const Resolver = require('./Resolver');
const templates = require('../../templates/static');

const RESOLUTIONS = Object.freeze({
    ping: [new Resolution(templates.test.ping, 'fix', 'Run Ansible ping module')],
    alwaysFail: [new Resolution(templates.test.alwaysFail, 'fix', 'Always fail')],
    failHalfTheTime: [new Resolution(templates.test.failHalfTheTime, 'fix', 'fail half the time')],
    reboot: [new Resolution(templates.test.rebootTrigger, 'fix', 'Reboot system', true, false, 4)],
    missingVariable: [new Resolution(templates.test.missingVariable, 'fix')],
    debug: [
        new Resolution(templates.test.ping, 'alternative', 'Ping twice', false, false, 2),
        new Resolution(templates.test.ping, 'fix', 'Ping once', false, false, 1)
    ]
});

module.exports = class TestResolver extends Resolver {
    async resolveResolutions (id) {
        if (RESOLUTIONS[id.issue]) {
            return RESOLUTIONS[id.issue];
        }

        return [];
    }
};
