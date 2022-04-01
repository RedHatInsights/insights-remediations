'use strict';

const _ = require('lodash');
const etag = require('etag');

const errors = require('../errors');
const queries = require('./remediations.queries');
const format = require('./remediations.format');
const probes = require('../probes');

const fifi = require('./fifi');

const notMatching = res => res.sendStatus(412);
const notFound = res => res.sendStatus(404);

exports.checkExecutable = errors.async(async function (req, res) {
    const remediation = await queries.get(req.params.id, req.user.account_number, req.user.username);

    if (!remediation) {
        return notFound(res);
    }

    const executable = await fifi.checkSmartManagement(remediation, req.entitlements.smart_management);

    if (!executable) {
        throw new errors.Forbidden();
    }

    res.sendStatus(200);
});

exports.connection_status = errors.async(async function (req, res) {
    const [remediation, rhcEnabled] = await Promise.all([
        queries.get(req.params.id, req.user.account_number, req.user.username),
        fifi.checkRhcEnabled()
    ]);

    if (!remediation) {
        return notFound(res);
    }

    const smartManagement = await fifi.checkSmartManagement(remediation, req.entitlements.smart_management);

    if (!smartManagement) {
        throw new errors.Forbidden();
    }

    const status = await fifi.getConnectionStatus(
        remediation,
        req.identity.account_number,
        req.entitlements.smart_management,
        rhcEnabled
    );

    res.set('etag', etag(JSON.stringify(status)));
    res.json(format.connectionStatus(status));
});

exports.executePlaybookRuns = errors.async(async function (req, res) {
    const [remediation, rhcEnabled] = await Promise.all([
        queries.get(req.params.id, req.user.account_number, req.user.username),
        fifi.checkRhcEnabled()
    ]);

    if (!remediation) {
        return notFound(res);
    }

    const smartManagement = await fifi.checkSmartManagement(remediation, req.entitlements.smart_management);

    if (!smartManagement) {
        throw new errors.Forbidden();
    }

    const status = await fifi.getConnectionStatus(
        remediation,
        req.identity.account_number,
        req.entitlements.smart_management,
        rhcEnabled
    );
    const currentEtag = etag(JSON.stringify(status));

    res.set('etag', currentEtag);

    probes.optimisticLockCheck(req.headers['if-match'], currentEtag, req.identity.account_number);
    if (req.headers['if-match'] && currentEtag !== req.headers['if-match']) {
        return notMatching(res);
    }

    const result = await fifi.createPlaybookRun(
        status,
        remediation,
        req.user.username,
        req.body.exclude,
        req.body.response_mode
    );

    if (_.isNull(result)) {
        throw errors.noExecutors(remediation);
    }

    res.status(201).send({id: result});
});

exports.cancelPlaybookRuns = errors.async(async function (req, res) {
    const [executors, remediation] = await Promise.all([
        queries.getRunningExecutors(req.params.id, req.params.playbook_run_id, req.user.account_number, req.user.username),
        queries.getRunDetails(req.params.id, req.params.playbook_run_id, req.user.account_number, req.user.username)
    ]);

    if (_.isEmpty(executors) && !_.isEmpty(remediation.playbook_runs[0].executors)) {
        return notFound(res);
    }

    await fifi.cancelPlaybookRun(
        req.user.account_number,
        req.identity.org_id,
        req.params.playbook_run_id,
        req.user.username, executors
    );

    res.status(202).send({});
});

exports.listPlaybookRuns = errors.async(async function (req, res) {
    const {column, asc} = format.parseSort(req.query.sort);
    const {limit, offset} = req.query;
    let remediation = await queries.getPlaybookRuns(req.params.id, req.user.account_number, req.user.username, column, asc);

    if (!remediation) {
        return notFound(res);
    }

    remediation = remediation.toJSON();

    // Join rhcRuns and playbookRuns
    remediation.playbook_runs = await fifi.combineRuns(remediation);

    const total = fifi.getListSize(remediation.playbook_runs);

    remediation.playbook_runs = await fifi.pagination(remediation.playbook_runs, total, limit, offset);

    if (_.isNull(remediation)) {
        throw errors.invalidOffset(offset, total);
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
        req.user.account_number,
        req.user.username
    );

    if (!remediation) {
        return notFound(res);
    }

    remediation = remediation.toJSON();

    // Join rhcRuns and playbookRuns
    remediation.playbook_runs = await fifi.combineRuns(remediation);

    remediation = await fifi.resolveUsers(req, remediation);

    // Update playbook_run status based on executor status (RHC)
    await fifi.updatePlaybookRunsStatus(remediation.playbook_runs);

    const formated = format.playbookRunDetails(remediation.playbook_runs);

    res.status(200).send(formated);
});

exports.getSystems = errors.async(async function (req, res) {
    const {column, asc} = format.parseSort(req.query.sort);
    const {limit, offset} = req.query;
    // eslint-disable-next-line prefer-const
    let [systems, rhcRunHosts] = await Promise.all([
        queries.getSystems(
            req.params.id,
            req.params.playbook_run_id,
            req.query.executor,
            req.query.ansible_host,
            req.user.account_number,
            req.user.username
        ),
        fifi.getRHCRuns(req.params.playbook_run_id)
    ]);

    if (!req.query.ansible_host && rhcRunHosts) {
        if (req.query.executor && _.isEmpty(systems)) {
            systems = fifi.formatRunHosts(rhcRunHosts, req.params.playbook_run_id);
        }

        if (!req.query.executor) {
            fifi.combineHosts(rhcRunHosts, systems, req.params.playbook_run_id);
        }
    }

    if (_.isEmpty(systems)) {
        const remediation = await queries.getRunDetails(
            req.params.id,
            req.params.playbook_run_id,
            req.user.account_number,
            req.user.username
        );

        if (!remediation) {
            return notFound(res);
        }
    }

    // Pagination
    const total = fifi.getListSize(systems);
    if (offset >= Math.max(total, 1)) {
        throw errors.invalidOffset(offset, total);
    }

    systems = fifi.pagination(systems, total, limit, offset);

    // Sort Systems: default system_name ASC
    systems = fifi.sortSystems(systems, column, asc);

    const formatted = format.playbookSystems(systems, total);

    res.status(200).send(formatted);
});

exports.getSystemDetails = errors.async(async function (req, res) {
    let system = await queries.getSystemDetails(
        req.params.id,
        req.params.playbook_run_id,
        req.params.system,
        req.user.account_number,
        req.user.username
    );

    if (system) {
        system = system.toJSON();
    }

    if (!system) {
        system = await fifi.getRunHostDetails(req.params.playbook_run_id, req.params.system);

        if (!system) {
            return notFound(res);
        }
    }

    const formated = format.playbookSystemDetails(system);
    const currentEtag = etag(JSON.stringify(formated));

    res.set('etag', currentEtag);

    res.status(200).send(formated);
});
