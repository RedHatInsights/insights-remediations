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
const trace = require('../util/trace');
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
    trace.enter('generator.controller.playbookPipeline');

    trace.event('Fetch systems...');
    await exports.resolveSystems(issues, strict);

    trace.event('Parse issue identifiers...');
    _.forEach(issues, issue => {
        issue.id = identifiers.parse(issue.id);
        trace.event(`issue.id = ${issue.id}`);
    });

    trace.event('Get play snippets for each issue...');
    issues = await P.map(issues, issue => issueManager.getPlayFactory(issue.id).createPlay(issue, strict).catch((e) => {
        trace.event(`Caught error getting snippet for: ${JSON.stringify(issue.id)}`);
        trace.event(`(error: ${JSON.stringify(e)})`)

        if (strict) {
            probes.failedGeneration(issue.id);
            throw e;
        }

        trace.event(`Skipping issue: ${issue.id}`);
        log.warn(e, `Skipping unknown issue: ${issue.id}`);
    })).filter(issue => issue);

    if (issues.length === 0) {
        trace.leave('Returning: no issues');
        return;
    }

    if (localhost) {
        trace.event('Set hosts to \'localhost\'...');
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

    trace.event('Aggregate erratum plays...');
    issues = erratumPlayAggregator.process(issues);

    // Add play that generates a new Compliance report when there are Compliance(ssg) issues  
    const complianceIssue = _.some(issues, issue => issue.id.app === 'ssg');
    if (complianceIssue) {
        trace.event('Generate new Compliance report...');
        issues = addComplianceReportPlay(issues);
    }

    trace.event('Add reboot play...');
    issues = addRebootPlay(issues, auto_reboot, localhost);

    // post run check-in is already included in the localhost reboot snippet...
    if ( !(localhost && auto_reboot)) {
        trace.event('Add post run check-in play...');
        issues = addPostRunCheckIn(issues);
    }

    trace.event('Add dianosis play...');
    issues = addDiagnosisPlay(issues, remediation);

    trace.event('Render yaml...');
    const yaml = format.render(issues, remediation);

    trace.event('Validate yaml...')
    format.validate(yaml);

    trace.leave();
    return { yaml, definition };
};

exports.generate = errors.async(async function (req, res) {
    trace.enter('generator.controller.generate');

    const input = { ...req.body };
    trace.event(`generate playbook for: ${JSON.stringify(input)}`);
    const playbook = await exports.playbookPipeline(input);

    trace.leave();
    return exports.send(req, res, playbook);
});

exports.systemToHost = function (system) {
    return system.ansible_host || system.hostname || system.id;
};

exports.resolveSystems = async function (issues, strict = true) {
    trace.enter('generator.controller.resolveSystems');

    const systemIds = _(issues).flatMap('systems').uniq().value();
    if (systemIds.length <= 25) { // avoid logging huge list...
        trace.event(`System IDs: ${JSON.stringify(systemIds)}`);
    }

    // bypass cache as ansible_host may change so we want to grab the latest one
    trace.event('Get system details...');
    const systems = await inventory.getSystemDetailsBatch(systemIds, true);

    if (!strict) {
        trace.event('Remove systems for which we have no inventory entry...');
        _.forEach(issues, issue => issue.systems = issue.systems.filter((id) => {
            // eslint-disable-next-line security/detect-object-injection
            return (systems.hasOwnProperty(id));
        }));
    }

    trace.event('Verify that there are no systems for which we have no inventory entry...');
    _.forEach(issues, issue => issue.hosts = issue.systems.map(id => {
        if (!systems.hasOwnProperty(id)) {
            trace.event(`Found no data for system: ${id}`);
            probes.failedGeneration(issue.id);
            throw errors.unknownSystem(id);
        }

        // validated by openapi middleware and also above
        // eslint-disable-next-line security/detect-object-injection
        const system = systems[id];
        return exports.systemToHost(system);
    }));
    trace.event('All systems verified!');

    if (!strict) {
        trace.event('Remove issues with no systems...')
        issues = _.filter(issues, (issue) => (issue.systems.length > 0));
    }

    trace.leave();
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

function addComplianceReportPlay (plays) {
    const hosts = _(plays).flatMap('hosts').uniq().sort().value();
    return [...plays, new SpecialPlay('compliance:generate-report', hosts, templates.compliance.generateReport)];
}

function addDiagnosisPlay (plays, remediation = false) {
    const diagnosisPlays = plays.filter(play => play.needsDiagnosis());

    if (!diagnosisPlays.length) {
        return plays;
    }

    const hosts = _(diagnosisPlays).flatMap('hosts').uniq().sort().value();
    return [new SpecialPlay('special:diagnosis', hosts, templates.special.diagnosis), ...plays];
}

exports.send = async function (req, res, {yaml, definition}, attachment = false) {
    res.set('Content-type', 'text/vnd.yaml');
    res.set('etag', playbookEtag(yaml));

    if (attachment) {
        res.set('Content-disposition', `attachment;filename="${attachment}"`);
    }

    if (req.stale) {
        probes.playbookGenerated(req, definition, attachment);
        await storePlaybookDefinition(req, definition, attachment);
        res.send(yaml).end();
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
            username: _.get(req, 'identity.user.username', ''),
            account_number: _.get(req, 'identity.account_number', ''),
            tenant_org_id: req.identity.org_id,
            filename,
            definition: JSON.stringify(definition)
        });
    } catch (e) {
        log.error(e, 'error storing playbook definition to archive');
    }
}
