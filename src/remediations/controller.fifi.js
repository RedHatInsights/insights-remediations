'use strict';

const _ = require('lodash');
const etag = require('etag');

const errors = require('../errors');
const queries = require('./remediations.queries');
const format = require('./remediations.format');
const probes = require('../probes');

const fifi = require('./fifi');

const getTrace = require('../util/trace');

const notMatching = res => res.sendStatus(412);
const notFound = res => res.sendStatus(404);

exports.checkExecutable = errors.async(async function (req, res) {
    const remediation = await queries.get(req.params.id, req.user.tenant_org_id, req.user.username);

    if (!remediation) {
        return notFound(res);
    }

    res.sendStatus(200);
});

exports.cancelPlaybookRuns = errors.async(async function (req, res) {
    const remediation = await queries.getRunDetails(
        req.params.id,
        req.params.playbook_run_id,
        req.user.tenant_org_id,
        req.user.username
    );

    if (!remediation) {
        return notFound(res);
    }

    await fifi.cancelPlaybookRun(
        req,
        req.identity.org_id,
        req.params.playbook_run_id,
        req.user.username
    );

    res.status(202).send({});
});

exports.listPlaybookRuns = errors.async(async function (req, res) {
    const {column, asc} = format.parseSort(req.query.sort);
    const {limit, offset} = req.query;
    let remediation = await queries.getPlaybookRuns(req.params.id, req.user.tenant_org_id, req.user.username, column, asc);

    if (!remediation) {
        return notFound(res);
    }

    remediation = remediation.toJSON();

    // Join rhcRuns and playbookRuns
    remediation.playbook_runs = await fifi.combineRuns(req, remediation);

    const total = fifi.getListSize(remediation.playbook_runs);

    remediation.playbook_runs = await fifi.pagination(remediation.playbook_runs, total, limit, offset);

    if (_.isNull(remediation)) {
        throw errors.invalidOffset(offset, total, req);
    }

    remediation = await fifi.resolveUsers(req, remediation);

    // Update playbook_run status based on executor status (RHC)
    await fifi.updatePlaybookRunsStatus(remediation.playbook_runs);

    const formated = format.playbookRuns(remediation.playbook_runs, total);

    res.status(200).send(formated);
});

exports.getRunDetails = errors.async(async function (req, res) {
    // eslint-disable-next-line prefer-const
    let remediation = await queries.getRunDetails(
        req.params.id,
        req.params.playbook_run_id,
        req.user.tenant_org_id,
        req.user.username
    );

    if (!remediation) {
        return notFound(res);
    }

    remediation = remediation.toJSON();

    // Join rhcRuns and playbookRuns
    remediation.playbook_runs = await fifi.combineRuns(req, remediation);

    remediation = await fifi.resolveUsers(req, remediation);

    // Update playbook_run status based on executor status (RHC)
    await fifi.updatePlaybookRunsStatus(remediation.playbook_runs);

    const formated = format.playbookRunDetails(remediation.playbook_runs);

    res.status(200).send(formated);
});

exports.getSystems = errors.async(async function (req, res) {
    getTrace(req).enter('fifi.getSystems');

    const {column, asc} = format.parseSort(req.query.sort);
    const {limit, offset} = req.query;

    // Verify the playbook run belongs to the user's remediation
    const remediation = await queries.getRunDetails(
        req.params.id,
        req.params.playbook_run_id,
        req.user.tenant_org_id,
        req.user.username
    );

    if (!remediation) {
        getTrace(req).leave('Playbook run not found or not authorized');
        return notFound(res);
    }

    // Systems come from playbook-dispatcher for both RHC-direct and RHC-satellite.
    // Optional query param:
    //   ?ansible_host=<substring> - filter by partial hostname match

    // Note: ?executor param is accepted but not currently used for filtering.

    // Get RHC runs from dispatcher
    getTrace(req).event('fetch RHC runs from dispatcher...');
    const rhcRuns = await fifi.getRHCRuns(req, req.params.playbook_run_id);
    getTrace(req).event(`RHC runs: ${rhcRuns}`);

    // Get systems from RHC runs, filtered by ansible_host if provided
    let systems = [];
    if (!_.isEmpty(rhcRuns)) {
        getTrace(req).event('Get systems from RHC runs...');
        await fifi.combineHosts(
            req,
            rhcRuns,
            systems,
            req.params.playbook_run_id,
            req.query.ansible_host
        );
    }

    // Pagination
    // TODO: we should trim the systems list before gathering the details for each system and then trimming that
    getTrace(req).event('paginate...');
    const total = fifi.getListSize(systems);
    if (offset >= Math.max(total, 1)) {
        throw errors.invalidOffset(offset, total, req);
    }

    systems = fifi.pagination(systems, total, limit, offset);

    // Sort Systems: default system_name ASC
    getTrace(req).event('sort...');
    systems = fifi.sortSystems(systems, column, asc);

    const formatted = format.playbookSystems(systems, total);

    getTrace(req).leave(`send: ${formatted}`);
    res.status(200).send(formatted);
});

// Get details for a specific system in a playbook run (RHC-direct or RHC-satellite)
exports.getSystemDetails = errors.async(async function (req, res) {
    getTrace(req).enter('controller.fifi.getSystemDetails');

    // Verify the playbook run belongs to the user's remediation
    const remediation = await queries.getRunDetails(
        req.params.id,
        req.params.playbook_run_id,
        req.user.tenant_org_id,
        req.user.username
    );

    if (!remediation) {
        getTrace(req).leave('Playbook run not found or not authorized');
        return notFound(res);
    }

    const system = await fifi.getRunHostDetails(req, req.params.playbook_run_id, req.params.system);

    if (!system) {
        getTrace(req).leave('System not found');
        if (req.trace) {
            req.trace.force = true;
        }

        return notFound(res);
    }

    getTrace(req).event(`raw system info: ${JSON.stringify(system)}`);

    const formated = format.playbookSystemDetails(system);
    const currentEtag = etag(JSON.stringify(formated));

    res.set('etag', currentEtag);

    getTrace(req).event(`returning: ${JSON.stringify(formated)}`);

    getTrace(req).leave();
    res.status(200).send(formated);
});
