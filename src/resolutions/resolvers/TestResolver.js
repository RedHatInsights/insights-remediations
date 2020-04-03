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
    ],
    pause1m: [new Resolution(templates.test.pause1m, 'fix', 'Run Ansible pause module waiting 1 minute')],
    pause5m: [
        new Resolution(templates.test.pause5m, 'fix', 'Run Ansible pause module waiting 5 minutes'),
        new Resolution(
            templates.test.pauseVerbose5m,
            'verbose',
            'Run Ansible pause module waiting 5 minutes (3sec iterations)'
        )
    ],
    pause15m: [new Resolution(templates.test.pause15m, 'fix', 'Run Ansible pause module waiting 15 minutes')],
    pause1h: [new Resolution(templates.test.pause1h, 'fix', 'Run Ansible pause module waiting 1 hour')],
    pause6h: [new Resolution(templates.test.pause6h, 'fix', 'Run Ansible pause module waiting 6 hours')],
    pauseRandom15m: [new Resolution(
        templates.test.pauseRandom15m,
        'fix',
        'Run Ansible pause module waiting a random delay (up to 15 minutes)'
    )]
});

module.exports = class TestResolver extends Resolver {
    async resolveResolutions (id) {
        if (RESOLUTIONS[id.issue]) {
            return RESOLUTIONS[id.issue];
        }

        return [];
    }
};
