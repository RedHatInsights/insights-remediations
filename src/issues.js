'use strict';

const config = require('./config');
const errors = require('./errors');

const advisor = require('./connectors/advisor');
const compliance = require('./connectors/compliance');
const vulnerabilities = require('./connectors/vulnerabilities');
const vmaas = require('./connectors/vmaas');

const advisorFactory = require('./generator/factories/AdvisorFactory');
const complianceFactory = require('./generator/factories/ComplianceFactory');
const cveFactory = require('./generator/factories/CveFactory');
const vulnerabilityFactory = require('./generator/factories/VulnerabilityFactory');
const testFactory = require('./generator/factories/TestFactory');

const ERRATUM_PATTERN = /^RH[SBE]A-20[\d]{2}:[\d]{4,5}/;
const CVE_PATTERN = /^CVE-20[\d]{2}-[\d]{4,}$/;

class Handler {

    async getIssueDetails () {
        throw new Error('not implemented');
    }

    getPlayFactory () {
        throw new Error('not implemented');
    }
}

const advisorHandler = new class extends Handler {

    async getIssueDetails (id) {
        const raw = await advisor.getRule(id.issue);
        return {
            description: raw.description,
            raw
        };
    }

    getPlayFactory () {
        return advisorFactory;
    }
}();

const cveHandler = new class extends Handler {
    async getIssueDetails (id) {
        const raw = await vmaas.getCve(id.issue);
        return {
            description: id.issue,
            raw
        };
    }

    getPlayFactory () {
        return cveFactory;
    }
}();

const erratumHandler = new class extends Handler {
    async getIssueDetails (id) {
        const raw = await vmaas.getErratum(id.issue);
        return {
            description: id.issue,
            raw
        };
    }

    getPlayFactory () {
        return cveFactory;
    }
}();

const vulnerabilitiesHandler = new class extends Handler {
    async getIssueDetails (id) {
        const raw = await vulnerabilities.getRule(id.issue);
        return {
            description: raw.description,
            raw
        };
    }

    getPlayFactory () {
        return vulnerabilityFactory;
    }
}();

const complianceHandler = new class extends Handler {
    async getIssueDetails (id) {

        // TODO: what if 404
        const raw = await compliance.getRule(id.issue);

        return {
            description: raw.data.attributes.title,
            raw
        };
    }

    getPlayFactory () {
        return complianceFactory;
    }
}();

const testHandler = new class extends Handler {
    getPlayFactory () {
        return testFactory;
    }
}();

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

            return vulnerabilitiesHandler;
        case 'test':
            if (config.env !== 'production') { // disable test handler in prod
                return testHandler;
            }

        default:
            throw errors.unknownIssue(id);
    }
}

exports.getIssueDetails = function (id) {
    return getHandler(id).getIssueDetails(id);
};

exports.getPlayFactory = function (id) {
    return getHandler(id).getPlayFactory(id);
};
