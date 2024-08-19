'use strict';

const _ = require('lodash');
const P = require('bluebird');
const errors = require('../errors');
const issues = require('../issues');
const queries = require('./remediations.queries');
const identifiers = require('../util/identifiers');
const AdvisorHandler = require('../issues/AdvisorHandler');
const CVEHandler = require('../issues/CVEHandler');
const trace = require("../util/trace");

async function resolveStatus (issue) {
    trace.enter('status.resolveStatus');

    trace.event(`Get handler for issue: ${issue.id}`);
    const handler = issues.getHandler(issue.id);

    if (handler instanceof AdvisorHandler || handler instanceof CVEHandler) {
        trace.event('Get systems for Advisor or CVE issues');
        const affectedSystems = await handler.getSystems(issue.id);
        // TODO: this is quite inefficient
        trace.event(`Filter issue systems: ${issue.systems}`);
        issue.systems = _.mapValues(issue.systems, (value, key) => !affectedSystems.includes(key));
    }

    trace.leave();
}

exports.status = errors.async(async function (req, res) {
    trace.enter('status.status');

    trace.event('Query db for remediation');
    let remediation = await queries.get(req.params.id, req.user.tenant_org_id, req.user.username);

    if (!remediation) {
        trace.event('Remediation not found (returning 404)');
        trace.leave();
        return res.status(404).json();
    }

    trace.event(`Collect array of issues with parsed identifier and system_ids: ${remediation.issues}`);
    const issues = _.map(remediation.issues, issue => ({
        ...issue,
        id: identifiers.parse(issue.issue_id),
        systems: _(issue.systems).keyBy('system_id').mapValues(() => null).value()
    }));

    trace.event(`Resolve status of all issues: ${issues}`);
    await P.map(issues, resolveStatus);

    const result = {
        summary: {
            total: _.sumBy(issues, issue => _.size(issue.systems)),
            resolved: _.sumBy(issues, issue => _(issue.systems).values().sumBy(value => value === true ? 1 : 0))
            // TODO incomplete?
        },
        data: _(issues).keyBy('id.full').mapValues(issue => issue.systems)
    };

    res.json(result);

    trace.leave(`Return result: ${JSON.stringify(result)}`);
});
