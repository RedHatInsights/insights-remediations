'use strict';

const config = require('../config');
const errors = require('../errors');

const ERRATUM_PATTERN = /^RH[SBE]A-20[\d]{2}:[\d]{4,5}/;
const CVE_PATTERN = /^CVE-20[\d]{2}-[\d]{4,}$/;

const advisorHandler = new(require('./AdvisorHandler'))();
const vulnerabilityHandler = new(require('./VulnerabilityHandler'))();
const cveHandler = new(require('./CVEHandler'))();
const erratumHandler = new(require('./ErratumHandler'))();
const complianceHandler = new(require('./ComplianceHandler'))();
const testHandler = new(require('./TestHandler'))();

/* eslint no-fallthrough: off */
function getHandler (id) {
    switch (id.app) {
        case 'advisor': return advisorHandler;
        case 'compliance': return complianceHandler;
        case 'vulnerabilities':
            if (CVE_PATTERN.test(id.issue)) {
                return cveHandler;
            }

            if (ERRATUM_PATTERN.test(id.issue)) {
                return erratumHandler;
            }

            return vulnerabilityHandler;
        case 'test':
            if (config.env !== 'production') { // disable test handler in prod
                return testHandler;
            }

        default:
            throw errors.unknownIssue(id);
    }
}

exports.getHandler = getHandler;

exports.getIssueDetails = function (id) {
    return getHandler(id).getIssueDetails(id);
};

exports.getPlayFactory = function (id) {
    return getHandler(id).getPlayFactory(id);
};
