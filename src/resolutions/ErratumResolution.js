'use strict';

const version = require('../util/version');
const Resolution = require('./Resolution');
const ERRATA_TEMPLATE = require('../templates/static').patchman.errata;
const PACKAGE_TEMPLATE = require('../templates/static').patchman.packages;
const CVES_TEMPLATE = require('../templates/static').vulnerabilities.cves;

class ErratumResolution extends Resolution {
    constructor (id, details, issueType, template, description) {
        super(template, 'fix', description, true, false);
        this.details = details;
        this.issueType = issueType;
        this.version = version.commit;
    }
}

exports.forCve = (id, details) =>
    new ErratumResolution(id, details, 'cve', CVES_TEMPLATE, `Upgrade packages affected by ${id.issue}`);

exports.forAdvisory = (id, details) =>
    new ErratumResolution(id, details, 'erratum', ERRATA_TEMPLATE, `Apply ${id.issue}`);

exports.forPackage = (id, details) =>
    new ErratumResolution(id, details, 'package', PACKAGE_TEMPLATE, `Upgrade packages ${id.issue}`);

exports.isErratumResolution = (resolution) => { return (resolution instanceof ErratumResolution); };
