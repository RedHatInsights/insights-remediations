'use strict';

const errors = require("../errors");
const queries = require("./remediations.queries");
const fifi = require("./fifi_2");
const _ = require("lodash");
const dispatcher = require("../connectors/dispatcher");
const etag = require("etag");
const probes = require("../probes");

const notMatching = res => res.sendStatus(412);
const notFound = res => res.sendStatus(404);

exports.executePlaybookRuns = errors.async(async function (req, res) {
    const remediationId = req.params.id;
    const tenantOrgId = req.user.tenant_org_id;
    const username = req.user.username;
    const exclude = req.body.exclude || [];

    //----------------------------------------------------------------
    // fetch remediation and GET enabled status from config-manager
    //----------------------------------------------------------------
    const [remediation, rhcEnabled] = await Promise.all([
        queries.get(remediationId, tenantOrgId, username),
        fifi.checkRhcEnabled()
    ]);

    if (!remediation) {
        // 404 if remediation not found
        return notFound(res);
    }

    if (!rhcEnabled) {
        // 403 if remediations not enabled
        throw new errors.Forbidden();
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

    //-----------------------------------------------
    // get connection status of referenced systems
    //-----------------------------------------------
    const connectionStatusRequest = {
        org_id:  tenantOrgId,
        hosts: systemIds
    };

    const recipients = dispatcher.getConnectionStatus(connectionStatusRequest);


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
