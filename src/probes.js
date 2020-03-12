'use strict';

require('lodash');
const client = require('prom-client');

const log = require('./util/log');
const { prefix } = require('./config').metrics;

const ETAG_STATES = ['matched', 'mismatch', 'check_skipped'];
const PERMISSIONS = [
    'remediations:remediation:read',
    'remediations:remediation:write',
    'remediations:remediation:execute'
];

const playbookCounter = new client.Counter({
    name: `${prefix}playbooks_generated`,
    help: `Counter of generated Playbooks`
});

const rbacCounter = new client.Counter({
    name: `${prefix}rbac_errors_generated`,
    help: `Counter of rbac errors`,
    labelNames: ['rbacPermission']
});

const etagErrorCounter = new client.Counter({
    name: `${prefix}fifi_etag_checks`,
    help: `Counter of etag optimistic lock checks`,
    labelNames: ['status']
});

const playbookExecutionCounter = new client.Counter({
    name: `${prefix}playbooks_executed`,
    help: `Counter of Playbooks to be executed`
});

// https://www.robustperception.io/existential-issues-with-metrics
ETAG_STATES.forEach(value => etagErrorCounter.labels(value).inc(0));
PERMISSIONS.forEach(value => rbacCounter.labels(value).inc(0));

/*
 * Domain probes.
 * https://martinfowler.com/articles/domain-oriented-observability.html
 */
exports.playbookGenerated = function (req, {auto_reboot, issues}, name) {
    playbookCounter.inc();
    log.info({
        username: req.user.username,
        email: req.identity.user.email,
        account_number: req.user.account_number,
        name,
        auto_reboot,
        issue_count: issues.length,
        digest: issues.map(issue => issue.hosts.length).join()
    }, 'playbook generated');
};

exports.rbacErrorCount = function (permission, availablePermissions) {
    rbacCounter.labels(permission).inc();
    log.info({
        rbac_permission: permission,
        available_permissions: availablePermissions
    }, 'Rejecting access due to missing RBAC permission');
};

exports.optimisticLockCheck = function (oldEtag, newEtag, accountNumber) {
    if (!oldEtag) {
        etagErrorCounter.labels('check_skipped').inc();
    }

    if (oldEtag && oldEtag !== newEtag) {
        etagErrorCounter.labels('mismatch').inc();
        log.info({
            account_number: accountNumber,
            previousEtag: oldEtag,
            currentEtag: newEtag
        }, 'Etag Verification Failure');
    }

    if (oldEtag && oldEtag === newEtag) {
        etagErrorCounter.labels('matched').inc();
    }
};

exports.splitPlaybookPerSatId = function (receptorWorkRequest, satId, remediation, playbookRunId) {
    playbookExecutionCounter.inc();
    log.info({
        account: receptorWorkRequest.account,
        recipient: receptorWorkRequest.recipient,
        satelite_id: satId,
        remediation_id: remediation.id,
        remediation_name: remediation.name,
        playbook_run_id: playbookRunId
    }, 'Playbook before being sent to receptor controller');
    log.debug({
        job: receptorWorkRequest,
        satelite_id: satId
    }, 'Full Contents of Work Request before being sent to receptor controller');
};

exports.receptorJobDispatched = function (receptorWorkRequest, executor, response, remediation, playbookRunId) {
    log.info({
        account: receptorWorkRequest.account,
        job_id: response.id,
        recipient: receptorWorkRequest.recipient,
        satelite_id: executor.satId,
        remediation_id: remediation.id,
        remediation_name: remediation.name,
        playbook_run_id: playbookRunId
    }, 'receptor work request sent');
};
