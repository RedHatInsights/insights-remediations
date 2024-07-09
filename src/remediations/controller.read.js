'use strict';

const _ = require('lodash');
const P = require('bluebird');
const etag = require('etag');
const JSZip = require('jszip');
const errors = require('../errors');
const log = require('../util/log');
const trace = require('../util/trace');
const issues = require('../issues');
const queries = require('./remediations.queries');
const format = require('./remediations.format');
const disambiguator = require('../resolutions/disambiguator');
const inventory = require('../connectors/inventory');
const identifiers = require('../util/identifiers');
const generator = require('../generator/generator.controller');
const users = require('../connectors/users');
const fifi = require('./fifi');

const notFound = res => res.status(404).json();
const noContent = res => res.sendStatus(204);
const badRequest = res => res.sendStatus(400);

const SATELLITE_NAMESPACE = Object.freeze({namespace: 'satellite'});

const catchErrorCode = (code, fn) => e => {
    if (e.error && e.error.code === code) {
        return fn(e);
    }

    throw e;
};

function resolveResolutions (...remediations) {
    return P.all(_(remediations).flatMap('issues').map(async issue => {
        const id = identifiers.parse(issue.issue_id);
        const resolutions = await issues.getHandler(id).getResolutionResolver().resolveResolutions(id);
        const resolution = disambiguator.disambiguate(resolutions, issue.resolution, id, false, false);

        if (resolution) {
            issue.resolution = resolution;
            issue.resolutionsAvailable = resolutions.length;
        } else {
            issue.resolution = false;
        }
    }).value());
}

function resolveResolutionsNeedReboot (...remediations) {
    return P.all(_(remediations).flatMap('issues').map(async issue => {
        const id = identifiers.parse(issue.issue_id);
        const needsReboot = await issues.getHandler(id).getResolutionResolver().isRebootNeeded(id, issue.resolution);

        if (needsReboot !== null) {
            issue.resolution = { needsReboot };
        } else {
            issue.resolution = false;
        }
    }).value());
}

exports.getUsers = async function (req, usernames) {
    // if the only user is the currently logged-in user then bypass users connector
    if (usernames.length === 1 && req.identity.user && req.identity.user.username === usernames[0]) {
        const { username, first_name, last_name } = req.identity.user;
        return {
            [username]: { username, first_name, last_name }
        };
    }

    const resolvedUsers = await P.map(usernames, username => users.getUser(username));
    return _.keyBy(resolvedUsers, 'username');
};

exports.getUser = function (resolvedUsersById, username) {
    if (_.has(resolvedUsersById, username)) {
        // validated above
        // eslint-disable-next-line security/detect-object-injection
        return resolvedUsersById[username];
    }

    return {
        username,
        first_name: 'Unknown',
        last_name: 'User'
    };
};

async function resolveUsers (req, ...remediations) {
    const usernames = _(remediations).flatMap(({created_by, updated_by}) => [created_by, updated_by]).uniq().value();
    const resolvedUsersById = await exports.getUsers(req, usernames);

    remediations.forEach(remediation => {
        remediation.created_by = exports.getUser(resolvedUsersById, remediation.created_by);
        remediation.updated_by = exports.getUser(resolvedUsersById, remediation.updated_by);
    });
}

function inferNeedsReboot (remediation) {
    return _.some(remediation.issues, 'resolution.needsReboot');
}

exports.list = errors.async(async function (req, res) {
    trace.enter('controller.read.list');

    if (_.get(req, 'query.fields.data', []).includes('name') && Array.isArray(_.get(req, 'query.fields.data', []))) {
        throw new errors.BadRequest('INVALID_REQUEST', `'name' cannot be combined with other fields.`);
    }

    trace.event('Get sort and query parms from url');
    const {column, asc} = format.parseSort(req.query.sort);
    const {offset, hide_archived} = req.query;
    var limit = req.query.limit;

    // Check for name in fields query param:
    // fields[data]=name
    if (_.get(req, 'query.fields.data', []).includes('name')) {
        trace.event('Include name data');
        let plan_names = await queries.getPlanNames(
            req.user.tenant_org_id
        );

        plan_names = _.map(plan_names, name => name.toJSON())

        const total = fifi.getListSize(plan_names);
        limit = limit || 1;

        trace.event('Format response');
        const resp = format.planNames(plan_names, total, limit, offset, req.query.sort, req.query.system)

        trace.leave();

        return res.json(resp);
    }

    trace.event('Query db for list of remediations');
    const {count, rows} = await queries.list(
        req.user.tenant_org_id,
        req.user.username,
        req.query.system,
        column,
        asc,
        req.query.filter,
        hide_archived,
        limit,
        offset);

    trace.event('Validate offset query parm');
    if (offset >= Math.max(count.length, 1)) {
        throw errors.invalidOffset(offset, count.length - 1);
    }

    trace.event('Fetch remediation details from DB');
    let remediations = await queries.loadDetails(req.user.tenant_org_id, req.user.username, rows);

    if (column === 'name') {
        trace.event('Accomodate sort ordering for null names');
        // TODO: remove null name support?
        // if sorting by name re-order as db does not order null names (Unnamed playbook) properly
        remediations = _.orderBy(remediations, [r => (r.name || '').toLowerCase()], [asc ? 'asc' : 'desc']);
    }

    trace.event('Resolve user names and reboot flag');
    await P.all([
        resolveResolutionsNeedReboot(...remediations),
        resolveUsers(req, ...remediations)
    ]);

    // Add 'details' if they exist to each issue in remediation.issues
    trace.event('Fetch issue details');
    await P.map(remediations, remediation => resolveIssues(remediation));

    trace.event('Remove empty issues');
    remediations.forEach(remediation => {
        // filter out issues with 0 systems, unknown issues and details
        remediation.issues = remediation.issues.filter(issue => issue.resolution && issue.details);
        remediation.needs_reboot = inferNeedsReboot(remediation);

        // issue_count is not filtered on 0 systems by default
        remediation.issue_count = remediation.issues.length;

        // if system_count & issue_count = 0 set resolved_count to 0
        if (remediation.system_count === 0 && remediation.issue_count === 0) {
            remediation.resolved_count = 0;
        }
    });

    // Check for playbook_runs in fields query param:
    //    fields[data]=playbook_runs
    if (_.get(req, 'query.fields.data', []).includes('playbook_runs')) {
        trace.event('Include playbook_runs data');

        // set limit to 1 if not explicitly set & fields[data]=playbook_runs
        limit = limit || 1;

        let iteration = 1;
        await P.map(remediations, async (remediation) => {
            const local_iteration = iteration++;
            trace.enter(`[${local_iteration}] Process remediation: ${remediation.id}`);
            trace.event(`[${local_iteration}] Fetch playbook run`);
            let playbook_runs = await queries.getPlaybookRuns(
                remediation.id,
                req.user.tenant_org_id,
                req.user.username
            );

            playbook_runs = playbook_runs?.toJSON();

            // Join rhcRuns and playbookRuns
            trace.event(`[${local_iteration}] Combine runs`);
            playbook_runs.iteration = local_iteration;
            playbook_runs.playbook_runs = await fifi.combineRuns(playbook_runs);

            trace.event(`[${local_iteration}] Resolve users`);
            playbook_runs = await fifi.resolveUsers(req, playbook_runs);

            // Update playbook_run status based on executor status (RHC)
            trace.event(`[${local_iteration}] Update playbook run status`);
            fifi.updatePlaybookRunsStatus(playbook_runs.playbook_runs);

            trace.event(`[${local_iteration}] Format playbook run`);
            remediation.playbook_runs = format.formatRuns(playbook_runs.playbook_runs);

            trace.leave(`[${local_iteration}] Process remediation: ${remediation.id}`);
        })
    }

    trace.event('Format response');
    const resp = format.list(remediations, count.length, limit, offset, req.query.sort, req.query.system);

    trace.leave();

    return res.json(resp);
});

async function resolveSystems (remediation) {
    const systems = _.flatMap(remediation.issues, 'systems');
    const ids = _(systems).map('system_id').uniq().value();

    const resolvedSystems = await inventory.getSystemDetailsBatch(ids);

    remediation.issues.forEach(issue => issue.systems = issue.systems
    .filter(({system_id}) => _.has(resolvedSystems, system_id)) // filter out systems not found in inventory
    .map(({system_id, resolved}) => {
        // filtered above
        // eslint-disable-next-line security/detect-object-injection
        const { hostname, display_name } = resolvedSystems[system_id];
        return { system_id, hostname, display_name, resolved };
    }));
}

function resolveIssues (remediation) {
    return P.map(remediation.issues, async issue => {
        const id = identifiers.parse(issue.issue_id);
        return issues.getIssueDetails(id)
        .then(result => issue.details = result)
        .catch(catchErrorCode('UNKNOWN_ISSUE', () => issue.details = false));
    });
}

function orderSystems (systems, column, asc = true) {
    return _.orderBy(systems, [column, 'id'], [asc ? 'asc' : 'desc']);
}

exports.get = errors.async(async function (req, res) {
    let remediation = await queries.get(req.params.id, req.user.tenant_org_id, req.user.username);

    if (!remediation) {
        return notFound(res);
    }

    remediation = remediation.toJSON();

    await P.all([
        resolveSystems(remediation),
        resolveResolutions(remediation),
        resolveIssues(remediation),
        resolveUsers(req, remediation)
    ]);

    // filter out issues with 0 systems or missing issue details
    remediation.issues = remediation.issues.filter(issue => issue.systems.length && issue.details && issue.resolution);

    remediation.needs_reboot = inferNeedsReboot(remediation);

    res.json(format.get(remediation));
});

exports.bulkPlaybook = errors.async(async function (req, res) {
    // copy body array to request object and pass through to playbook()
    req.query.hosts = req.body;
    return exports.playbook(req, res);
});

exports.playbook = errors.async(async function (req, res) {
    const id = req.params.id;
    const selected_hosts = req.query.hosts;
    const localhost = req.query.localhost;
    const sat_org_id = req.query.sat_org;
    const cert_auth = _.isUndefined(req.user);

    const tenant_org_id = req.identity.org_id;
    const creator = cert_auth ? null : req.user.username;

    const remediation = await queries.get(id, tenant_org_id, creator);

    if (!remediation) {
        return notFound(res);
    }

    const issues = remediation.toJSON().issues;

    if (issues.length === 0) {
        return noContent(res);
    }

    let normalizedIssues = generator.normalizeIssues(issues);

    if (_.isEmpty(normalizedIssues)) {
        return noContent(res);
    }

    // remove any hosts not in selected_host list
    if (selected_hosts) {
        _.forEach(normalizedIssues, issue => {
            issue.systems = _.filter(issue.systems, system => selected_hosts.includes(system));
        });
    }

    if (sat_org_id || cert_auth) {
        // get list of unique systems from issues
        const all_systems = _(normalizedIssues)
        .map('systems')
        .flatten()
        .uniq()
        .value();

        // remove any systems not in specified satellite organization
        if (sat_org_id) {
            const batchDetailInfo = await inventory.getSystemDetailsBatch(all_systems);
            _.forEach(normalizedIssues, issue => {
                issue.systems = _.filter(issue.systems, system => {
                    // eslint-disable-next-line security/detect-object-injection
                    const org_id = _.chain(batchDetailInfo[system].facts)
                    .find(SATELLITE_NAMESPACE)
                    .get('facts.organization_id')
                    .toString(); //organization_id is an int (boo!)

                    return _.isEqual(org_id, sat_org_id);
                });
            });
        }

        // validate system ownership if using certificate authentication
        if (cert_auth) {
            const batchProfileInfo = await inventory.getSystemProfileBatch(all_systems);

            if (_.isEmpty(batchProfileInfo)) {
                return notFound(res); // Eh, this is really more of an internal error...
            }

            all_systems.forEach(system => {
                if (!_.has(batchProfileInfo, `[${system}].system_profile.owner_id`)) {
                    throw errors.internal.systemProfileMissing(null, `Missing profile for system: ${system}`);
                }

                // eslint-disable-next-line security/detect-object-injection
                const ownerId = batchProfileInfo[system].system_profile.owner_id;
                if (!_.isEqual(req.identity.system.cn, ownerId)) {
                    throw errors.unauthorizedGeneration(req.identity.system.cn);
                }
            });
        }
    }

    // If any issues have 0 systems based on the changes above filter them out
    normalizedIssues = _.filter(normalizedIssues, issue => !_.isEmpty(issue.systems));

    if (_.isEmpty(normalizedIssues)) { // If all issues are filtered return 404
        return notFound(res);
    }

    const playbook = await generator.playbookPipeline({
        issues: normalizedIssues,
        auto_reboot: remediation.auto_reboot
    }, remediation, false, localhost);

    if (!playbook) {
        return noContent(res);
    }

    generator.send(req, res, playbook, format.playbookName(remediation));
});

exports.downloadPlaybooks = errors.async(async function (req, res) {
    const zip = new JSZip();
    let generateZip = true;

    if (!req.query.selected_remediations) {
        return badRequest(res);
    }

    await P.map(req.query.selected_remediations, async id => {
        const remediation = await queries.get(id, req.user.tenant_org_id, req.user.username);

        if (!remediation) {
            generateZip = false;
            return notFound(res);
        }

        const issues = remediation.toJSON().issues;

        if (issues.length === 0) {
            generateZip = false;
            return noContent(res);
        }

        const normalizedIssues = generator.normalizeIssues(issues);

        const playbook = await generator.playbookPipeline({
            issues: normalizedIssues,
            auto_reboot: remediation.auto_reboot
        }, remediation, false);

        if (!playbook) {
            generateZip = false;
            return noContent(res);
        }

        zip.file(format.playbookName(remediation), playbook.yaml);
    });

    if (generateZip) {
        zip.generateAsync({type: 'nodebuffer'}).then(zipBuffer => {
            res.set('Content-type', 'application/zip');
            res.set('Content-disposition', 'attachment;filename=remediations.zip');
            res.set('etag', etag(zipBuffer, { weak: true }));
            if (req.stale) {
                res.send(zipBuffer).end();
            } else {
                res.status(304).end();
            }
        });
    }
});

exports.getIssueSystems = errors.async(async function (req, res) {
    const {id, issue} = req.params;
    const {column, asc} = format.parseSort(req.query.sort);
    const {tenant_org_id, username} = req.user;
    const {limit, offset} = req.query;

    const remediation = await queries.getIssueSystems(id, tenant_org_id, username, issue);

    if (!remediation) {
        return notFound(res);
    }

    await resolveSystems(remediation);

    // filter out issues with 0 systems
    remediation.issues = remediation.issues.filter(issue => issue.systems.length);

    if (_.isEmpty(remediation.issues)) {
        return notFound(res);
    }

    remediation.issues[0].systems = orderSystems(remediation.issues[0].systems, column, asc);

    const total = fifi.getListSize(remediation.issues[0].systems);

    remediation.issues[0].systems = await fifi.pagination(remediation.issues[0].systems, total, limit, offset);

    if (_.isNull(remediation.issues[0].systems)) {
        throw errors.invalidOffset(offset, total);
    }

    res.json(format.issueSystems(remediation.issues[0], total));
});
