'use strict';

const client = require('prom-client');

const log = require('./util/log');
const { prefix } = require('./config').metrics;

const playbookCounter = new client.Counter({
    name: `${prefix}playbooks_generated`,
    help: `Counter of generated Playbooks`
});

const rbacCounter = new client.Counter({
    name: `${prefix}rbac_errors_generated`,
    help: `Counter of rbac errors`,
    labelNames: ['rbacPermission']
});

const PERMISSIONS = [
    'remediations:remediation:read',
    'remediations:remediation:write',
    'remediations:resolution:read',
    'remediations:remediation:execute'
];

// https://www.robustperception.io/existential-issues-with-metrics
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

exports.rbacErrorCount = function (permission) {
    rbacCounter.labels(permission).inc();
    log.info({
        rbac_permission: permission
    }, 'Rejecting access due to missing RBAC permission');
};
