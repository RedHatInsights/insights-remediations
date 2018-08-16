'use strict';

const Resolution = require('../Resolution');
const templates = require('../../templates/static');

const RESOLUTIONS = Object.freeze({
    ping: [new Resolution(templates.test.ping, 'fix', 'Ping')],
    reboot: [new Resolution(templates.test.rebootTrigger, 'fix', 'Reboot system', true, false, 4)],
    missingVariable: [new Resolution(templates.test.missingVariable, 'fix')],
    debug: [
        new Resolution(templates.test.ping, 'alternative', 'Ping twice', false, false, 2),
        new Resolution(templates.test.ping, 'fix', 'Ping once', false, false, 1)
    ]
});

exports.resolveResolutions = async function (id) {
    if (RESOLUTIONS[id.issue]) {
        return RESOLUTIONS[id.issue];
    }

    return [];
};

