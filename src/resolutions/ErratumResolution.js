'use strict';

const Resolution = require('./Resolution');
const ERRATA_TEMPLATE = require('../templates/static').vulnerabilities.errata;

module.exports = class ErratumResolution extends Resolution {
    constructor (erratum) {
        super(ERRATA_TEMPLATE, 'fix', true, false);
        this.erratum = erratum;
    }
};
