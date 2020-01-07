'use strict';

const read = require('./controller.read');
const write = require('./controller.write');
const fifi = require('./controller.fifi');
const status = require('./controller.status');
const openapi = require('../middleware/openapi');
const smartManagement = require('../middleware/identity/smartManagement');

module.exports = function (router) {
    router.get('/remediations', openapi('getRemediations'), read.list);
    router.post('/remediations', openapi('createRemediation'), write.create);

    router.get('/remediations/:id', openapi('getRemediation'), read.get);
    router.patch('/remediations/:id', openapi('updateRemediation'), write.patch);
    router.delete('/remediations/:id', openapi('deleteRemediation'), write.remove);

    router.get('/remediations/:id/playbook', openapi('getRemediationPlaybook'), read.playbook);
    router.get('/remediations/:id/status', status.status); // TODO: openapi mw

    router.patch('/remediations/:id/issues/:issue', openapi('updateRemediationIssue'), write.patchIssue);
    router.delete('/remediations/:id/issues/:issue', openapi('deleteRemediationIssue'), write.removeIssue);

    router.delete(
        '/remediations/:id/issues/:issue/systems/:system',
        openapi('deleteRemediationIssueSystem'),
        write.removeIssueSystem);

    router.get('/remediations/:id/connection_status',
        openapi('getRemediationConnectionStatus'),
        smartManagement,
        fifi.connection_status);

    router.post('/remediations/:id/playbook_runs',
        openapi('runRemediation'),
        smartManagement,
        fifi.executePlaybookRuns);
};
