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
const getTrace = require('../util/trace');
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

exports.playbookPipeline = async function (req, {issues, auto_reboot = true}, remediation = false, strict = true, localhost = false) {
    getTrace(req).enter('generator.controller.playbookPipeline');

    getTrace(req).event('Fetch systems...');
    // Use return value to get issues with empty systems filtered out (when strict=false)
    issues = await exports.resolveSystems(req, issues, strict);

    getTrace(req).event('Parse issue identifiers...');
    _.forEach(issues, issue => {
        issue.id = identifiers.parse(issue.id, req);
        getTrace(req).event(`issue.id = ${issue.id}`);
    });

    getTrace(req).event('Get play snippets for each issue...');
    issues = await P.map(issues, issue => issueManager.getPlayFactory(req, issue.id).createPlay(req, issue, strict).catch((e) => {
        getTrace(req).event(`Caught error getting snippet for: ${JSON.stringify(issue.id)}`);
        getTrace(req).event(`(error: ${JSON.stringify(e)})`)

        // Always throw an error if an issue cannot be added to the playbook
        // to prevent generating partial playbooks with missing issues
        probes.failedGeneration(`failed to get snippet for issue: ${issue.id}`);
        throw e;
    })).filter(issue => issue);

    if (issues.length === 0) {
        getTrace(req).leave('Returning: no issues');
        return;
    }

    if (localhost) {
        getTrace(req).event('Set hosts to \'localhost\'...');
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

    getTrace(req).event('Aggregate erratum plays...');
    issues = erratumPlayAggregator.process(issues);

    // Add play that generates a new Compliance report when there are Compliance(ssg) issues  
    const complianceIssue = _.some(issues, issue => issue.id.app === 'ssg');
    if (complianceIssue) {
        getTrace(req).event('Generate new Compliance report...');
        issues = addComplianceReportPlay(issues);
    }

    getTrace(req).event('Add reboot play...');
    issues = addRebootPlay(issues, auto_reboot, localhost);

    // post run check-in is already included in the localhost reboot snippet...
    if ( !(localhost && auto_reboot)) {
        getTrace(req).event('Add post run check-in play...');
        issues = addPostRunCheckIn(issues);
    }

    getTrace(req).event('Add dianosis play...');
    issues = addDiagnosisPlay(issues, remediation);

    getTrace(req).event('Render yaml...');
    const yaml = format.render(issues, remediation);

    getTrace(req).event('Validate yaml...')
    format.validate(yaml);

    getTrace(req).leave();
    return { yaml, definition };
};

exports.generate = errors.async(async function (req, res) {
    getTrace(req).enter('generator.controller.generate');

    const input = { ...req.body };

    // Sort issues by precedence (NULLS LAST), otherwise maintain original request order
    input.issues = _.orderBy(input.issues, [issue => issue.precedence == null ? 1 : 0, 'precedence']);

    getTrace(req).event(`generate playbook for: ${JSON.stringify(input)}`);
    const playbook = await exports.playbookPipeline(req, input);

    getTrace(req).leave();
    return exports.send(req, res, playbook);
});

exports.systemToHost = function (system) {
    return system.ansible_host || system.hostname || system.id;
};

/**
 * Resolves system IDs to hostnames by fetching system details from Inventory.
 * Adds a `hosts` property to each issue containing the resolved hostnames.
 *
 * @param {Array} issues - Array of issue objects, each containing a `systems` array of system IDs
 * @param {boolean} strict - Controls error handling for missing systems:
 *   - true (default): Throws UNKNOWN_SYSTEM error if any system ID is not found in Inventory
 *   - false: Gracefully handles missing systems by filtering them out and removing empty issues
 *
 * Returns the issues array with `hosts` added to each issue
 * Or throws UNKNOWN_SYSTEM error if strict=true and some systems weren't found in Inventory.
 * When strict=false, missing systems are filtered out and issues with no remaining systems are removed.
 */
exports.resolveSystems = async function (req, issues, strict = true) {
    getTrace(req).enter('generator.controller.resolveSystems');

    const systemIds = _(issues).flatMap('systems').uniq().value();
    if (systemIds.length <= 25) { // avoid logging huge list...
        getTrace(req).event(`System IDs: ${JSON.stringify(systemIds)}`);
    }

    getTrace(req).event('Get system details...');
    // Fetch system details from Inventory:
    // - refresh=true: bypass cache as ansible_host may change
    // - strict=true: throw UNKNOWN_SYSTEM error if any systems are missing
    // - strict=false: return partial results with only known systems
    const systems = await inventory.getSystemDetailsBatch(req, systemIds, true, 2, strict)
        .catch(e => {
            probes.failedGeneration('unknown system(s)');
            throw e;
        });

    // When strict=false, filter out missing systems from issues
    if (!strict) {
        getTrace(req).event('Remove systems for which we have no inventory entry...');
        _.forEach(issues, issue => issue.systems = issue.systems.filter((id) => {
            // eslint-disable-next-line security/detect-object-injection
            return (systems.hasOwnProperty(id));
        }));
    }

    // Map system IDs to hostnames
    getTrace(req).event('Map system IDs to hosts...');
    _.forEach(issues, issue => issue.hosts = issue.systems.map(id => {
        // eslint-disable-next-line security/detect-object-injection
        const system = systems[id];
        return exports.systemToHost(system);
    }));
    getTrace(req).event('All systems mapped!');

    // If strict=false, filter out issues with no systems (systems that were removed because they don't exist in Inventory)
    if (!strict) {
        getTrace(req).event('Remove issues with no systems...')
        issues = _.filter(issues, (issue) => (issue.systems.length > 0));
    }

    getTrace(req).leave();
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
