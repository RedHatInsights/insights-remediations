'use strict';

const version = require('../util/version');
const Resolution = require('./Resolution');
const ERRATA_TEMPLATE = require('../templates/static').vulnerabilities.errata;
const CVES_TEMPLATE = require('../templates/static').vulnerabilities.cves;

class ErratumResolution extends Resolution {
    constructor (id, details, isAdvisory = false) {
        const template = isAdvisory ? ERRATA_TEMPLATE : CVES_TEMPLATE;
        super(template, 'fix', `Upgrade packages affected by ${id.issue}`, true, false);
        this.details = details;
        this.isAdvisory = isAdvisory;
        this.version = version.commit;
    }
}

exports.forCve = (id, details) => new ErratumResolution(id, details);
exports.forAdvisory = (id, details) => new ErratumResolution(id, details, true);
