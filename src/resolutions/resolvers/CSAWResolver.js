'use strict';

const log = require('../../util/log');
const Resolver = require('./Resolver');
const identifier = require('../../util/identifiers');
const advisorFactory = new(require('../../generator/factories/AdvisorFactory'))();
const cveFactory = new(require('../../generator/factories/CVEFactory'))();

module.exports = class CVEResolver extends Resolver {

    async resolveResolutions (issue, strict = true) {
        const ids = identifier.parseCSAW(issue.id);

        if (ids) {
            try {
                issue.id.issue = ids.csaw;
                return await advisorFactory.createPlay(issue, strict);
            } catch (e) {
                log.error('CSAW rule_id play creation failed, running default if available', e);
                issue.id.issue = ids.cve;
                return await cveFactory.createPlay(issue, strict);
            }
        }
    }
};
