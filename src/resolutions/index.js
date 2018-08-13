'use strict';

const Resolution = require('./Resolution');
const staticTemplates = require('../templates/static');

const templates = {
    test: {
        ping: new Resolution(staticTemplates.test.ping),
        reboot: new Resolution(staticTemplates.test.rebootTrigger, 'fix', true, false),
        missingVariable: new Resolution(staticTemplates.test.missingVariable)
    },
    vulnerabilities: {
        errata: new Resolution(staticTemplates.vulnerabilities.errata, 'fix', true)
    }
};

module.exports = Object.freeze(templates);
