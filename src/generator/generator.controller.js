'use strict';

const _ = require('lodash');
const P = require('bluebird');
const etag = require('etag');

const errors = require('../errors');
const inventory = require('../connectors/inventory');
const templates = require('../templates/static');
const SpecialPlay = require('./plays/SpecialPlay');
const format = require('./format');
const identifiers = require('../util/identifiers');
const erratumPlayAggregator = require('./erratumPlayAggregator');
const issueManager = require('../issues');
const log = require('../util/log');
const db = require('../db');
const probes = require('../probes');
const { commit } = require('../util/version');

exports.normalizeIssues = function (issues) {
    _.forEach(issues, issue => {
        issue.id = issue.issue_id;
        issue.systems = _.map(issue.systems, 'system_id');
    });

    return issues;
};

exports.playbookPipeline = async function ({issues, auto_reboot = true}, remediation = false, strict = true, localhost = false) {
    await exports.resolveSystems(issues, strict);
    _.forEach(issues, issue => issue.id = identifiers.parse(issue.id));

    issues = await P.map(issues, issue => issueManager.getPlayFactory(issue.id).createPlay(issue, strict).catch((e) => {
        if (strict) {
            probes.failedGeneration(issue.id);
            throw e;
        }

        log.warn(e, `Skipping unknown issue: ${issue.id}`);
    })).filter(issue => issue);

    if (issues.length === 0) {
        return;
    }

    if (localhost) {
        issues.forEach(issue => {
            issue.hosts = ['localhost'];
        });
    }

    // canonical playbook definition allows us to reconstruct the playbook some time later
    const definition = {
        version: commit,
        auto_reboot,
        issues: issues.map(({id, resolution, hosts}) => ({
            id: id.full,
            resolution: resolution.type,
            version: resolution.version || null,
            hosts}))
    };

    issues = erratumPlayAggregator.process(issues);
    issues = addRebootPlay(issues, auto_reboot, localhost);

    // post run check-in is already included in the localhost reboot snippet...
    if ( !(localhost && auto_reboot)) {
        issues = addPostRunCheckIn(issues);
    }

    issues = addDiagnosisPlay(issues, remediation);

    const yaml = format.render(issues, remediation);
    format.validate(yaml);

    return { yaml, definition };
};

exports.generate = errors.async(async function (req, res) {
    const input = { ...req.body };
    const playbook = await exports.playbookPipeline(input);
    return exports.send(req, res, playbook);
});

exports.systemToHost = function (system) {
    return system.ansible_host || system.hostname || system.id;
};

exports.resolveSystems = async function (issues, strict = true) {
    const systemIds = _(issues).flatMap('systems').uniq().value();

    // bypass cache as ansible_host may change so we want to grab the latest one
    const systems = await inventory.getSystemDetailsBatch(systemIds, true);

    if (!strict) {
        _.forEach(issues, issue => issue.systems = issue.systems.filter((id) => {
            // eslint-disable-next-line security/detect-object-injection
            return (systems.hasOwnProperty(id));
        }));
    }

    _.forEach(issues, issue => issue.hosts = issue.systems.map(id => {
        if (!systems.hasOwnProperty(id)) {
            probes.failedGeneration(issue.id);
            throw errors.unknownSystem(id);
        }

        // validated by openapi middleware and also above
        // eslint-disable-next-line security/detect-object-injection
        const system = systems[id];
        return exports.systemToHost(system);
    }));

    if (!strict) {
        issues = _.filter(issues, (issue) => (issue.systems.length > 0));
    }

    return issues;
};

function addRebootPlay (plays, autoReboot = true, localhost = false) {
    const rebootRequiringPlays = _.filter(plays, play => play.needsReboot());
    if (rebootRequiringPlays.length === 0) {
        return plays;
    }

    const hosts = _(rebootRequiringPlays).flatMap('hosts').uniq().sort().value();

    if (localhost) {
        return [
            ...plays,
            // eslint-disable-next-line max-len
            new SpecialPlay('special:reboot', hosts, autoReboot ? templates.special.rebootLocalHost : templates.special.rebootSuppressed)
        ];
    }

    return [
        ...plays,
        new SpecialPlay('special:reboot', hosts, autoReboot ? templates.special.reboot : templates.special.rebootSuppressed)
    ];
}

function addPostRunCheckIn (plays) {
    const hosts = _(plays).flatMap('hosts').uniq().sort().value();
    return [...plays, new SpecialPlay('special:post-run-check-in', hosts, templates.special.postRunCheckIn)];
}

function addDiagnosisPlay (plays, remediation = false) {
    const diagnosisPlays = plays.filter(play => play.needsDiagnosis());

    if (!diagnosisPlays.length) {
        return plays;
    }

    const hosts = _(diagnosisPlays).flatMap('hosts').uniq().sort().value();
    const params = {REMEDIATION: remediation ? ` ${remediation.id}` : ''};
    return [new SpecialPlay('special:diagnosis', hosts, templates.special.diagnosis, params), ...plays];
}

exports.send = function (req, res, {yaml, definition}, attachment = false) {
    res.set('Content-type', 'text/vnd.yaml');
    res.set('etag', playbookEtag(yaml));

    if (attachment) {
        res.set('Content-disposition', `attachment;filename="${attachment}"`);
    }

    if (req.stale) {
        res.send(yaml).end();
        probes.playbookGenerated(req, definition, attachment);
        storePlaybookDefinition(req, definition, attachment);
    } else {
        res.status(304).end();
    }
};

// remove timestamps and version info as versions of playbook templates sometimes change even if the template itself does not
function playbookEtag (playbook) {
    playbook = playbook.replace(/^# Generated by Red Hat Insights on .*$/mg, '#');
    playbook = playbook.replace(/^# Version: .*$/mg, '#');
    return etag(playbook, { weak: true });
}

async function storePlaybookDefinition(req, definition, filename) {
    try {
        await db.PlaybookArchive.create({
            username: req.user.username,
            account_number: req.user.account_number,
            tenant_org_id: req.user.tenant_org_id,
            filename,
            definition: JSON.stringify(definition)
        });
    } catch (e) {
        log.error(e, 'error storing playbook definition to archive');
    }
}
