'use strict';

const etag = require('etag');

const errors = require('../errors');
const queries = require('./remediations.queries');
const format = require('./remediations.format');

const fifi = require('./fifi');

const noContent = res => res.sendStatus(204);

exports.connection_status = errors.async(async function (req, res) {
    const remediation = await queries.get(req.params.id, req.user.account_number, req.user.username);
    if (!remediation) {
        return res.status(404).json();
    }

    const status = await fifi.getConnectionStatus(remediation, req.identity.account_number);

    res.set('etag', etag(JSON.stringify(status)));
    res.json(format.connectionStatus(status));
});

exports.executePlaybookRuns = errors.async(async function (req, res) {
    return noContent(res);
});
