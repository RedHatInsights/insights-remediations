'use strict';

const version = require('../util/version');
const Resolution = require('./Resolution');
const ERRATA_TEMPLATE = require('../templates/static').patchman.errata;
const PACKAGE_TEMPLATE = require('../templates/static').patchman.packages;
const CVES_TEMPLATE = require('../templates/static').vulnerabilities.cves;

class ErratumResolution extends Resolution {
    constructor (id, details, issueType, template, description, needsReboot) {
        super(template, 'fix', description, needsReboot, false);
        this.details = details;
        this.issueType = issueType;
        this.version = version.commit;
    }
}

exports.forCve = (id, details) =>
    new ErratumResolution(id, details, 'cve', CVES_TEMPLATE, `Upgrade packages affected by ${id.issue}`, true);

exports.forAdvisory = (id, details) => {
    // Advisory resolution can be used with responses from both vmaas and patch api
    // this piece of code resolves differences when it comes to reboot flag being stored differently in those responses
    // if the reboot flag is not found, it defaults to true
    const attributes = details.hasOwnProperty('attributes') ? details.attributes : details;
    const reboot = attributes.hasOwnProperty('requires_reboot') ? attributes.requires_reboot :
        attributes.hasOwnProperty('reboot_required') ? attributes.reboot_required : true;

    return new ErratumResolution(id, details, 'erratum', ERRATA_TEMPLATE, `Apply ${id.issue}`, reboot);
};

exports.forPackage = (id, details) =>
    new ErratumResolution(id, details, 'package', PACKAGE_TEMPLATE, `Upgrade packages ${id.issue}`, true);

exports.isErratumResolution = (resolution) => { return (resolution instanceof ErratumResolution); };
