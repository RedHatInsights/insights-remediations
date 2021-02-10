'use strict';

const errors = require('../errors');

const ERRATUM_PATTERN = /^RH[SBE]A-20[\d]{2}:[\d]{4,5}/;
const CSAW_PATTERN = /^CVE-20[\d]{2}-[\d]{4,}:\w+\|[A-Z\d_]+$/;
const ADVISOR_PATTERN = /^\w+\|[A-Z\d_]+$/;
const CVE_PATTERN = /^CVE-20[\d]{2}-[\d]{4,}/;
// eslint-disable-next-line security/detect-unsafe-regex
const PKG_PATTERN = /^[a-z-._+]+-(\d+:)?([\d-]|\.)+-[a-z0-9-._+]+\.[a-z0-9-._+]+$/;

const advisorHandler = new(require('./AdvisorHandler'))();
const cveHandler = new(require('./CVEHandler'))();
const erratumHandler = new(require('./ErratumHandler'))();
const ssgHandler = new(require('./SSGHandler'))();
const testHandler = new(require('./TestHandler'))();
const patchmanHandler = new(require('./PatchmanHandler'))();
const packageHandler = new(require('./PackageHandler'))();
const csawHandler = new(require('./CSAWHandler'))();

/* eslint no-fallthrough: off */
function getHandler (id) {
    switch (id.app) {
        case 'advisor': return advisorHandler;
        case 'ssg': return ssgHandler;
        case 'vulnerabilities':
            if (CSAW_PATTERN.test(id.issue) || ADVISOR_PATTERN.test(id.issue)) {
                return csawHandler;
            }

            if (CVE_PATTERN.test(id.issue)) {
                return cveHandler;
            }

            if (ERRATUM_PATTERN.test(id.issue)) {
                return erratumHandler;
            }

            throw errors.unknownIssue(id);

        case 'test': return testHandler;
        case 'patch-advisory':
            if (ERRATUM_PATTERN.test(id.issue)) {
                return patchmanHandler;
            }

            return packageHandler; // TODO: remove after switching to "patch-package"
        case 'patch-package':
            if (PKG_PATTERN.test(id.issue)) {
                return packageHandler;
            }

            throw errors.unknownIssue(id);
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
