'use strict';

const log = require('../../util/log');
const Resolver = require('./Resolver');
const identifier = require('../../util/identifiers');
const vulnerabilities = require('../../connectors/vulnerabilities');
const shared = require('./SharedFunctions');
const errors = require('../../errors');

module.exports = class CVEResolver extends Resolver {

    async resolveResolutions (id) {
        const ids = identifier.parseCSAW(id);

        try {
            id.issue = ids.csaw;
            const templates = await vulnerabilities.getResolutions(id.issue);
            return templates.map(template => shared.parseResolution(template));
        } catch (e) {
            if (ids.cve) {
                log.error('CSAW rule_id play creation failed, running default if available', e);
                id.issue = ids.cve;
                return null;
            }

            throw errors.unknownCSAWRuleId(id.issue);
        }
    }
};
