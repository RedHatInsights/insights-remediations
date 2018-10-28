'use strict';

const _ = require('lodash');
const P = require('bluebird');
const errors = require('../errors');
const db = require('./remediations.db');
const format = require('./remediations.format');
const resolutions = require('../resolutions');
const inventory = require('../connectors/inventory');
const issues = require('../issues');
const identifiers = require('../util/identifiers');

const notFound = res => res.status(404).json();

// TODO: optimize overlapping issue IDs
// TODO: side-effects are ugly
function resolveResolutions (...remediations) {
    return P.all(_(remediations).flatMap('issues').map(async issue => {
        issue.resolution = await resolutions.resolveResolution(issue.issue_id, issue.resolution);
    }).value());
}

function determineNeedsReboot (remediation) {
    remediation.needsReboot = _.some(remediation.issues, 'resolution.needsReboot');
}

function determineSystemCount (remediation) {
    remediation.systemCount = _(remediation.issues).flatMap('systems').uniqBy('id').size();
}

exports.list = errors.async(async function (req, res) {
    const remediations = await db.list(req.identity.account_number, req.identity.id).map(r => r.toJSON());

    await resolveResolutions(...remediations);

    remediations.forEach(remediation => {
        determineNeedsReboot(remediation);
        determineSystemCount(remediation);
        remediation.issueCount = remediation.issues.length;
    });

    // TODO: resolve owner information

    res.json(format.list(remediations));
});

async function resolveSystems (remediation) {
    const systems = _.flatMap(remediation.issues, 'systems');
    const ids = _(systems).map('id').uniq().value();

    const systemDetails = await inventory.getSystemDetailsBatch(ids);

    _.forEach(systems, system => {
        const {hostname, display_name} = systemDetails[system.id];
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
    let remediation = await db.get(req.swagger.params.id.value, req.identity.account_number, req.identity.id);

    if (!remediation) {
        return notFound(res);
    }

    remediation = remediation.toJSON();

    await P.all([
        resolveSystems(remediation),
        resolveResolutions(remediation),
        resolveIssues(remediation)
    ]);

    res.json(format.get(remediation));
});

exports.create = errors.async(async function (req, res) {
    const { name } = req.swagger.params.body.value;

    const result = await db.create({
        name,
        tenant: req.identity.account_number,
        owner: req.identity.id
    });

    // TODO: 201 header
    res.status(201).json(format.get(result));
});

exports.remove = errors.async(async function (req, res) {
    const result = await db.destroy(req.swagger.params.id.value, req.identity.account_number, req.identity.id);
    result ? res.status(204).end() : notFound(res);
});
