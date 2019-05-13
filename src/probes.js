'use strict';

const client = require('prom-client');

const log = require('./util/log');
const { prefix } = require('./config').metrics;

const playbookCounter = new client.Counter({
    name: `${prefix}playbooks_generated`,
    help: `Counter of generated Playbooks`
});

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
