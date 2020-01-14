'use strict';

const _ = require('lodash');
const P = require('bluebird');
const errors = require('../errors');
const issues = require('../issues');
const queries = require('./remediations.queries');
const format = require('./remediations.format');
const disambiguator = require('../resolutions/disambiguator');
const inventory = require('../connectors/inventory');
const identifiers = require('../util/identifiers');
const generator = require('../generator/generator.controller');
const users = require('../connectors/users');

const notFound = res => res.status(404).json();
const noContent = res => res.sendStatus(204);

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

async function getUsers (req, usernames) {
    // if the only user is the currently logged-in user then bypass users connector
    if (usernames.length === 1 && req.identity.user && req.identity.user.username === usernames[0]) {
        const { username, first_name, last_name } = req.identity.user;
        return {
            [username]: { username, first_name, last_name }
        };
    }

    const resolvedUsers = await P.map(usernames, username => users.getUser(username));
    return _.keyBy(resolvedUsers, 'username');
}

async function resolveUsers (req, ...remediations) {
    const usernames = _(remediations).flatMap(({created_by, updated_by}) => [created_by, updated_by]).uniq().value();
    const resolvedUsersById = await getUsers(req, usernames);

    function getUser (username) {
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
    }

    remediations.forEach(remediation => {
        remediation.created_by = getUser(remediation.created_by);
        remediation.updated_by = getUser(remediation.updated_by);
    });
}

function parseSort (param) {
    if (!param) {
        throw new Error(`Invalid sort param value ${param}`);
    }

    if (param.startsWith('-')) {
        return {
            column: param.substring(1),
            asc: false
        };
    }

    return {
        column: param,
        asc: true
    };
}

function inferNeedsReboot (remediation) {
    return _.some(remediation.issues, 'resolution.needsReboot');
}

exports.list = errors.async(async function (req, res) {
    const {column, asc} = parseSort(req.query.sort);
    const {limit, offset} = req.query;

    const {count, rows} = await queries.list(
        req.user.account_number,
        req.user.username,
        req.query.system,
        column,
        asc,
        req.query.filter,
        limit,
        offset);

    if (offset >= Math.max(count.length, 1)) {
        throw errors.invalidOffset(offset, count.length - 1);
    }

    let remediations = await queries.loadDetails(req.user.account_number, req.user.username, rows);

    if (column === 'name') {
        // if sorting by name re-order as db does not order null names (Unnamed playbook) properly
        remediations = _.orderBy(remediations, [r => (r.name || '').toLowerCase()], [asc ? 'asc' : 'desc']);
    }

    await P.all([
        resolveResolutionsNeedReboot(...remediations),
        resolveUsers(req, ...remediations)
    ]);

    remediations.forEach(remediation => {
        // filter out issues with 0 systems and unknown issues
        remediation.issues = remediation.issues.filter(issue => issue.resolution);
        remediation.needs_reboot = inferNeedsReboot(remediation);
    });

    res.json(format.list(remediations, count.length, limit, offset, req.query.sort, req.query.system));
});

async function resolveSystems (remediation) {
    const systems = _.flatMap(remediation.issues, 'systems');
    const ids = _(systems).map('system_id').uniq().value();

    const resolvedSystems = await inventory.getSystemDetailsBatch(ids);

    remediation.issues.forEach(issue => issue.systems = issue.systems
    .filter(({system_id}) => _.has(resolvedSystems, system_id)) // filter out systems not found in inventory
    .map(({system_id}) => {
        // filtered above
        // eslint-disable-next-line security/detect-object-injection
        const { hostname, display_name } = resolvedSystems[system_id];
        return { system_id, hostname, display_name };
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

exports.get = errors.async(async function (req, res) {
    let remediation = await queries.get(req.params.id, req.user.account_number, req.user.username);

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

exports.playbook = errors.async(async function (req, res) {
    const remediation = await queries.get(req.params.id, req.user.account_number, req.user.username);

    if (!remediation) {
        return notFound(res);
    }

    const issues = remediation.toJSON().issues;

    if (issues.length === 0) {
        return noContent(res);
    }

    const normalizedIssues = generator.normalizeIssues(issues);

    const playbook = await generator.playbookPipeline({
        issues: normalizedIssues,
        auto_reboot: remediation.auto_reboot
    }, remediation, false);

    if (!playbook) {
        return noContent(res);
    }

    generator.send(req, res, playbook, format.playbookName(remediation));
});

