'use strict';

const errors = require("../errors");
const config = require('../config');
const featureFlags = require('../connectors/featureFlags');
const identifiers = require('../util/identifiers');
const queries = require("./remediations.queries");
const fifi = require("./fifi_2");
const _ = require("lodash");
const dispatcher = require("../connectors/dispatcher");
const etag = require("etag");
const probes = require("../probes");
const log = require('../util/log');
const format = require("./remediations.format_2");

const notMatching = res => res.sendStatus(412);
const notFound = res => res.sendStatus(404);

// Matches the action point values used by insights-remediations-frontend
const ACTION_POINTS_BY_TYPE = {
    advisor: 20,
    vulnerabilities: 20,
    'patch-advisory': 2,
    'patch-package': 2,
    ssg: 5
};

// Sum of each issues's action points (advisor/vulnerabilities: 20, patch: 2, ssg: 5)
// Examples: 3 Advisor issues → 20 + 20 + 20 = 60
//           10 Patch issues → 2 × 10 = 20
//           1 Advisor + 1 Compliance → 20 + 5 = 25
exports.calculateActionPoints = function (issues) {
    if (!issues || !Array.isArray(issues)) {
        return 0;
    }

    let total = 0;
    for (const issue of issues) {
        const issueId = issue.issue_id || issue.id;
        if (issueId) {
            const {app} = identifiers.parse(issueId);
            total += ACTION_POINTS_BY_TYPE[app] || 0;
        }
    }

    return total;
};

exports.validatePlanSize = function (issues, systemCount, req) {
    const { maxSystems, maxActionPoints, bypassFeatureFlag } = config.planLimits;

    if (featureFlags.isEnabled(bypassFeatureFlag, {
        userId: req.user.username,
        properties: {
            tenantOrgId: req.user.tenant_org_id,
            accountNumber: req.user.account_number
        }
    })) {
        return;
    }

    const actionPoints = exports.calculateActionPoints(issues);
    const messages = [];

    if (systemCount > maxSystems) {
        messages.push(`plan would contain ${systemCount} systems, exceeding the maximum of ${maxSystems}`);
    }

    if (actionPoints > maxActionPoints) {
        messages.push(`plan would contain ${actionPoints} action points, exceeding the maximum of ${maxActionPoints}`);
    }

    if (messages.length) {
        throw new errors.BadRequest('PLAN_SIZE_LIMIT_EXCEEDED',
            `Remediation plan exceeds size limits: ${messages.join('; ')}`);
    }
};


//-------------------------------------------------------------------------------------


exports.connection_status = errors.async(async function (req, res) {
    const remediationId = req.params.id;
    const tenantOrgId = req.user.tenant_org_id;
    const username = req.user.username;

    //----------------------------------------------------------------
    // verify remediation exists
    //----------------------------------------------------------------
    const remediation = await queries.checkPlanExistence(remediationId, tenantOrgId, username);

    if (!remediation) {
        // 404 if remediation not found
        return notFound(res);
    }

    //----------------------------------------------------------------
    // fetch distinct system ids for the plan
    //----------------------------------------------------------------
    const systemIds = await queries.getPlanSystemIds(remediationId, tenantOrgId, username);

    // If no systems, return empty result without calling dispatcher
    if (systemIds.length === 0) {
        return res.json(format.connectionStatus([]));
    }

    //-----------------------------------------------
    // get connection status of referenced systems
    //-----------------------------------------------
    const connectionStatusRequest = {
        org_id:  tenantOrgId,
        hosts: systemIds
    };

    const recipients = await dispatcher.getConnectionStatus(connectionStatusRequest);

    //-----------------
    // process e-tag
    //-----------------
    res.set('etag', etag(JSON.stringify(recipients)));


    const result = format.connectionStatus(recipients);

    res.json(result);
});


//-------------------------------------------------------------------------------------


exports.executePlaybookRuns = errors.async(async function (req, res) {
    const remediationId = req.params.id;
    const tenantOrgId = req.user.tenant_org_id;
    const username = req.user.username;
    const req_exclude = req.body.exclude || [];

    //----------------------------------------------------------------
    // sanitize excludes - make rhc uppercase!
    //----------------------------------------------------------------
    const exclude = req_exclude.map(entry => {
        if (entry.toUpperCase() === 'RHC') {
            return 'RHC';
        }
        else {
            return entry;
        }
    });

    //----------------------------------------------------------------
    // fetch remediation
    //----------------------------------------------------------------
    const remediation = await queries.get(remediationId, tenantOrgId, username);

    if (!remediation) {
        // Service accounts cannot execute remediation plans created by other users
        if (req.type === 'ServiceAccount') {
            const planExistsInOrg = await queries.checkPlanExistence(remediationId, tenantOrgId, null);
            // If the plan exists in the org but wasn't created by the service account, return 403
            if (planExistsInOrg) {
                throw new errors.Forbidden(
                    'Service accounts cannot execute remediation plans created by other users.'
                );
            }
        }

        return notFound(res);
    }

    //--------------------------------------------------------------
    // Extract unique, sorted list of system_ids from remediation
    //--------------------------------------------------------------
    const systemIds = [
        ... new Set(
            _(remediation.issues)
                .flatMap('systems')
                .map('system_id')
                .value()
        )
    ].sort();

    if (systemIds.length === 0) {
        // no systems
        throw errors.noSystems(remediation);
    }

    exports.validatePlanSize(remediation.issues, systemIds.length, req);

    //-----------------------------------------------
    // get connection status of referenced systems
    //-----------------------------------------------
    const connectionStatusRequest = {
        org_id:  tenantOrgId,
        hosts: systemIds
    };

    const recipients = await dispatcher.getConnectionStatus(connectionStatusRequest);
    log.error(`Requested status for ${connectionStatusRequest.hosts.length} hosts, received: ${JSON.stringify(recipients)}`);

    //-----------------
    // process e-tag
    //-----------------
    const currentEtag = etag(JSON.stringify(recipients));  // this needs to match what /status returns

    res.set('etag', currentEtag);

    probes.optimisticLockCheck(req.headers['if-match'], currentEtag, tenantOrgId);
    if (req.headers['if-match'] && currentEtag !== req.headers['if-match']) {
        return notMatching(res);
    }

    //--------------------------------------------------
    // createPlaybookRun
    //--------------------------------------------------
    const result = await fifi.createPlaybookRun(
        recipients,
        exclude,
        remediation,
        username
    );

    if (_.isNull(result)) {
        throw errors.noExecutors(remediation);
    }

    res.status(201).send({id: result});
});
