'use strict';

const _ = require('lodash');
const P = require('bluebird');
const etag = require('etag');

const errors = require('../errors');
const queries = require('./remediations.queries');
const format = require('./remediations.format');
const generator = require('../generator/generator.controller');

const fifi = require('./fifi');

const noContent = res => res.sendStatus(204);
const notMatching = res => res.sendStatus(412);
const notFound = res => res.status(404).json();

exports.connection_status = errors.async(async function (req, res) {
    const remediation = await queries.get(req.params.id, req.user.account_number, req.user.username);
    if (!remediation) {
        return notFound(res);
    }

    const status = await fifi.getConnectionStatus(remediation, req.identity.account_number);

    res.set('etag', etag(JSON.stringify(status)));
    res.json(format.connectionStatus(status));
});

exports.executePlaybookRuns = errors.async(async function (req, res) {
    const remediation = await queries.get(req.params.id, req.user.account_number, req.user.username);
    const remediationIssues = remediation.toJSON().issues;

    if (!remediation) {
        return notFound(res);
    }

    const status = await fifi.getConnectionStatus(remediation, req.identity.account_number);
    const currentEtag = etag(JSON.stringify(status));

    res.set('etag', currentEtag);

    if (req.headers['if-match'] && currentEtag !== req.headers['if-match']) {
        return notMatching(res);
    }

    const executors = _.filter(status, {status: 'connected'});

    await P.map(executors, async executor => {
        const filteredIssues = generator.normalizeIssues(
            await fifi.filterIssuesPerExecutor(executor.systems, remediationIssues)
        );
        // add playbook variable later
        await generator.playbookPipeline ({
            issues: filteredIssues,
            auto_reboot: remediation.auto_reboot
        }, remediation, false);
    });

    // This will be changed later
    return noContent(res);
});
