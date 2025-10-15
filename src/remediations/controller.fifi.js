'use strict';

const _ = require('lodash');
const etag = require('etag');

const errors = require('../errors');
const queries = require('./remediations.queries');
const format = require('./remediations.format');
const probes = require('../probes');

const fifi = require('./fifi');

const trace = require('../util/trace');

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
    const [executors, remediation] = await Promise.all([
        queries.getRunningExecutors(req.params.id, req.params.playbook_run_id, req.user.tenant_org_id, req.user.username),
        queries.getRunDetails(req.params.id, req.params.playbook_run_id, req.user.tenant_org_id, req.user.username)
    ]);

    const run_executor = _(remediation).get('playbook_runs[0].executors');

    if (_.isEmpty(executors) && !_.isEmpty(run_executor)) {
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
    let remediation = await queries.getPlaybookRuns(req.params.id, req.user.tenant_org_id, req.user.username, column, asc);

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
        req.user.tenant_org_id,
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
    trace.enter('fifi.getSystems');

    const {column, asc} = format.parseSort(req.query.sort);
    const {limit, offset} = req.query;

    trace.event('fetch receptor systems and rhc runs...')
    // eslint-disable-next-line prefer-const
    let [systems, rhcRuns] = await Promise.all([
        queries.getSystems(
            req.params.id,
            req.params.playbook_run_id,
            req.query.executor,
            req.query.ansible_host,
            req.user.tenant_org_id,
            req.user.username
        ),
        fifi.getRHCRuns(req.params.playbook_run_id)
    ]);

    // Ugh... so here are the possibilities:
    //   systems are either:
    //      RHC-direct   : from playbook-dispatcher (run_id)
    //      RHC-sat      : from playbook-dispatcher (run_id)
    //      receptor-sat : from db (run_id, ?executor)
    //
    //   ?ansible_host=<filter host substring>
    //   ?executor=<executor uuid>
    //
    //   if ?ansible_host then we need to filter all queries (partial matches!)
    //   if ?executor then we can stop searching when we find an executor match

    trace.event(`receptor systems: ${systems}`);
    trace.event(`RHC runs: ${rhcRuns}`);

    if (!req.query.executor || _.isEmpty(systems)) {
        // request not scoped to a single _receptor_ executor...
        // merge RHC hosts, scoped to :executor with substring :ansible_host
        // (N.B. executor_id === plabook_run_id for RHC)
        if (!_.isEmpty(rhcRuns)) {
            trace.event('Combine rhc and receptor systems...')
            await fifi.combineHosts(
                rhcRuns,
                systems,
                req.params.playbook_run_id,
                req.query.ansible_host);
        }
    }

    // did we scope this to a non-existent host / executor or does the
    // playbook run itself just not exist?
    if (_.isEmpty(systems)) {
        trace.event('system list empty, verify playbook run exists...');
        const remediation = await queries.getRunDetails(
            req.params.id,
            req.params.playbook_run_id,
            req.user.tenant_org_id,
            req.user.username
        );

        // return 404 if the run just doesn't exist
        if (!remediation) {
            trace.leave('playbook run not found');
            return notFound(res);
        }

        trace.force = true;
    }

    // Pagination
    // TODO: we should trim the systems list before gathering the details for each system and then trimming that
    trace.event('paginate...');
    const total = fifi.getListSize(systems);
    if (offset >= Math.max(total, 1)) {
        throw errors.invalidOffset(offset, total);
    }

    systems = fifi.pagination(systems, total, limit, offset);

    // Sort Systems: default system_name ASC
    trace.event('sort...');
    systems = fifi.sortSystems(systems, column, asc);

    const formatted = format.playbookSystems(systems, total);

    trace.leave(`send: ${formatted}`);
    res.status(200).send(formatted);
});

exports.getSystemDetails = errors.async(async function (req, res) {
    trace.enter('controller.fifi.getSystemDetails');
    let system = await queries.getSystemDetails(
        req.params.id,  // Whaaaaat?.... req.params.id is the REMEDIATION id...
        req.params.playbook_run_id,
        req.params.system,
        req.user.tenant_org_id,
        req.user.username
    );

    if (system) {
        system = system.toJSON();
        trace.event('Found (receptor?) db entry');
    }

    if (!system) {
        // rhc-direct or rhc-satellite system
        trace.event('get RHC system/satellite details from playbook-dispatcher');
        system = await fifi.getRunHostDetails(req.params.playbook_run_id, req.params.system);

        if (!system) {
            trace.leave('RHC system/satellite not found!');
            trace.force = true;
            return notFound(res);
        }
    }

    trace.event(`raw system info: ${JSON.stringify(system)}`);

    const formated = format.playbookSystemDetails(system);
    const currentEtag = etag(JSON.stringify(formated));

    res.set('etag', currentEtag);

    trace.event(`returning: ${JSON.stringify(formated)}`);

    trace.leave();
    res.status(200).send(formated);
});
