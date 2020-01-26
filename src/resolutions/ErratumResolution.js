'use strict';

const version = require('../util/version');
const Resolution = require('./Resolution');
const ERRATA_TEMPLATE = require('../templates/static').patchman.errata;
const CVES_TEMPLATE = require('../templates/static').vulnerabilities.cves;

class ErratumResolution extends Resolution {
    constructor (id, details, isAdvisory, template, description) {
        super(template, 'fix', description, true, false);
        this.details = details;
        this.isAdvisory = isAdvisory;
        this.version = version.commit;
    }
}

exports.forCve = (id, details) =>
    new ErratumResolution(id, details, false, CVES_TEMPLATE, `Upgrade packages affected by ${id.issue}`);

exports.forAdvisory = (id, details) =>
    new ErratumResolution(id, details, true, ERRATA_TEMPLATE, `Apply ${id.issue}`);
