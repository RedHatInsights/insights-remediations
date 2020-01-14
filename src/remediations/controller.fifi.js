'use strict';

const _ = require('lodash');
const etag = require('etag');

const errors = require('../errors');
const queries = require('./remediations.queries');
const format = require('./remediations.format');

const fifi = require('./fifi');

const notMatching = res => res.sendStatus(412);
const notFound = res => res.status(404).json();
const badRequest = res => res.sendStatus(400);

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

    if (!remediation) {
        return notFound(res);
    }

    const status = await fifi.getConnectionStatus(remediation, req.identity.account_number);
    const currentEtag = etag(JSON.stringify(status));

    res.set('etag', currentEtag);

    if (req.headers['if-match'] && currentEtag !== req.headers['if-match']) {
        return notMatching(res);
    }

    const result = await fifi.sendInitialRequest(status, remediation, req.identity.account_number);

    if (_.isNull(result)) {
        return badRequest(res);
    }

    if (_.isError(result)) {
        res.status(result.error.status).send(result.error.title);
    }

    res.status(201).send(result);
});
