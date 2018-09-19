'use strict';

const Resolution = require('./Resolution');
const ERRATA_TEMPLATE = require('../templates/static').vulnerabilities.errata;
const CVES_TEMPLATE = require('../templates/static').vulnerabilities.cves;

class ErratumResolution extends Resolution {
    constructor (id, details, isAdvisory = false) {
        const template = isAdvisory ? ERRATA_TEMPLATE : CVES_TEMPLATE;
        super(template, 'fix', `Update packages (${id.issue})`, true, false);
        this.details = details;
        this.isAdvisory = isAdvisory;
    }
}

exports.forCve = (id, details) => new ErratumResolution(id, details);
exports.forAdvisory = (id, details) => new ErratumResolution(id, details, true);
