'use strict';

const Resolution = require('./Resolution');
const ERRATA_TEMPLATE = require('../templates/static').vulnerabilities.errata;

module.exports = class ErratumResolution extends Resolution {
    constructor (id, erratum) {
        super(ERRATA_TEMPLATE, 'fix', `Update packages (${id.issue})`, true, false);
        this.erratum = erratum;
    }
};
