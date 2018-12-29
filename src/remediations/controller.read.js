'use strict';

const _ = require('lodash');
const P = require('bluebird');
const errors = require('../errors');
const queries = require('./remediations.queries');
const format = require('./remediations.format');
const resolutions = require('../resolutions');
const inventory = require('../connectors/inventory');
const issues = require('../issues');
const identifiers = require('../util/identifiers');
const generator = require('../generator/generator.controller');

const notFound = res => res.status(404).json();

// TODO: optimize overlapping issue IDs
// TODO: side-effects are ugly
function resolveResolutions (...remediations) {
    return P.all(_(remediations).flatMap('issues').map(async issue => {
        issue.resolution = await resolutions.resolveResolution(issue.issue_id, issue.resolution);
    }).value());
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
    const {column, asc} = parseSort(req.swagger.params.sort.value);

    // updated_at, name are sorted on the db level
    // issue_count, system_count on the app level below
    const dbColumn = ['updated_at', 'name'].includes(column) ? column : undefined;

    let remediations = await queries.list(req.user.account_number, req.user.username, dbColumn, asc).map(r => r.toJSON());

    await resolveResolutions(...remediations);

    remediations.forEach(remediation => {
        remediation.needs_reboot = inferNeedsReboot(remediation);
        remediation.system_count = _(remediation.issues).flatMap('systems').uniqBy('system_id').size();
        remediation.issue_count = remediation.issues.length;
    });

    // TODO: resolve owner information

    // TODO: it should be possible to move this down to db level using group_by after Sequelize is fixed
    if (dbColumn === undefined) {
        remediations = _.orderBy(remediations, [column, 'name'], [asc ? 'asc' : 'desc', 'asc']);
    }

    res.json(format.list(remediations));
});

async function resolveSystems (remediation) {
    const systems = _.flatMap(remediation.issues, 'systems');
    const ids = _(systems).map('system_id').uniq().value();

    const systemDetails = await inventory.getSystemDetailsBatch(ids);

    _.forEach(systems, system => {
        const {hostname, display_name} = systemDetails[system.system_id];
        system.hostname = hostname;
        system.display_name = display_name;
    });
}

function resolveIssues (remediation) {
    return P.all(remediation.issues.map(async issue => {
        const id = identifiers.parse(issue.issue_id);
        issue.details = await issues.getIssueDetails(id);
    }));
}

exports.get = errors.async(async function (req, res) {
    let remediation = await queries.get(req.swagger.params.id.value, req.user.account_number, req.user.username);

    if (!remediation) {
        return notFound(res);
    }

    remediation = remediation.toJSON();

    await P.all([
        resolveSystems(remediation),
        resolveResolutions(remediation),
        resolveIssues(remediation)
    ]);

    remediation.needs_reboot = inferNeedsReboot(remediation);

    res.json(format.get(remediation));
});

exports.playbook = errors.async(async function (req, res) {
    const remediation = await queries.get(req.swagger.params.id.value, req.user.account_number, req.user.username);

    if (!remediation) {
        return notFound(res);
    }

    const issues = remediation.toJSON().issues;
    issues.forEach(issue => {
        issue.id = issue.issue_id;
        issue.systems = _.map(issue.systems, 'system_id');
    });

    const playbook = await generator.playbookPipeline({
        issues
    }, remediation);

    generator.send(res, playbook, format.playbookName(remediation));
});
