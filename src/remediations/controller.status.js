'use strict';

const _ = require('lodash');
const P = require('bluebird');
const errors = require('../errors');
const issues = require('../issues');
const queries = require('./remediations.queries');
const identifiers = require('../util/identifiers');
const AdvisorHandler = require('../issues/AdvisorHandler');
const CVEHandler = require('../issues/CVEHandler');

async function resolveStatus (issue) {
    const handler = issues.getHandler(issue.id);

    if (handler instanceof AdvisorHandler || handler instanceof CVEHandler) {
        const affectedSystems = await handler.getSystems(issue.id);
        // TODO: this is quite inefficient
        issue.systems = _.mapValues(issue.systems, (value, key) => !affectedSystems.includes(key));
    }
}

exports.status = errors.async(async function (req, res) {
    let remediation = await queries.get(req.params.id, req.user.account_number, req.user.username);

    if (!remediation) {
        return res.status(404).json();
    }

    remediation = remediation.toJSON();

    const issues = _.map(remediation.issues, issue => ({
        ...issue,
        id: identifiers.parse(issue.issue_id),
        systems: _(issue.systems).keyBy('system_id').mapValues(() => null).value()
    }));

    await P.map(issues, resolveStatus);

    res.json({
        summary: {
            total: _.sumBy(issues, issue => _.size(issue.systems)),
            resolved: _.sumBy(issues, issue => _(issue.systems).values().sumBy(value => value === true ? 1 : 0))
            // TODO incomplete?
        },
        data: _(issues).keyBy('id.full').mapValues(issue => issue.systems)
    });
});
