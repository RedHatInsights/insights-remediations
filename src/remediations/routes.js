'use strict';

const read = require('./controller.read');
const write = require('./controller.write');
const fifi = require('./controller.fifi');
const status = require('./controller.status');
const openapi = require('../middleware/openapi');
const rbac = require('../middleware/rbac');

const rbacRead = rbac('remediations:remediation:read');
const rbacWrite = rbac('remediations:remediation:write');
const rbacExecute = rbac('remediations:remediation:execute');

module.exports = function (router) {
    router.get('/remediations', openapi('getRemediations'), rbacRead, read.list);
    router.post('/remediations', openapi('createRemediation'), rbacWrite, write.create);
    router.get('/remediations/download', openapi('downloadPlaybooks'), rbacRead, read.downloadPlaybooks);

    router.get('/remediations/:id', openapi('getRemediation'), rbacRead, read.get);
    router.patch('/remediations/:id', openapi('updateRemediation'), rbacWrite, write.patch);
    router.delete('/remediations/:id', openapi('deleteRemediation'), rbacWrite, write.remove);

    router.get('/remediations/:id/status', rbacRead, status.status); // TODO: openapi mw

    router.patch(
        '/remediations/:id/issues/:issue',
        openapi('updateRemediationIssue'),
        rbacWrite,
        write.patchIssue);

    router.delete(
        '/remediations/:id/issues/:issue',
        openapi('deleteRemediationIssue'),
        rbacWrite,
        write.removeIssue);

    router.get(
        '/remediations/:id/issues/:issue/systems',
        openapi('getRemediationIssueSystems'),
        rbacRead,
        read.getIssueSystems);

    router.delete(
        '/remediations/:id/issues/:issue/systems/:system',
        openapi('deleteRemediationIssueSystem'),
        rbacWrite,
        write.removeIssueSystem);

    router.get('/remediations/:id/connection_status',
        openapi('getRemediationConnectionStatus'),
        rbacExecute,
        fifi.connection_status);

    router.get('/remediations/:id/playbook_runs',
        openapi('listPlaybookRuns'),
        rbacRead,
        fifi.listPlaybookRuns);

    router.post('/remediations/:id/playbook_runs',
        openapi('runRemediation'),
        rbacExecute,
        fifi.executePlaybookRuns);

    router.get('/remediations/:id/playbook_runs/:playbook_run_id',
        openapi('getPlaybookRunDetails'),
        rbacRead,
        fifi.getRunDetails);

    router.post('/remediations/:id/playbook_runs/:playbook_run_id/cancel',
        openapi('cancelPlaybookRuns'),
        rbacExecute,
        fifi.cancelPlaybookRuns);

    router.get('/remediations/:id/playbook_runs/:playbook_run_id/systems',
        openapi('getPlaybookRunSystems'),
        rbacRead,
        fifi.getSystems);

    router.get('/remediations/:id/playbook_runs/:playbook_run_id/systems/:system',
        openapi('getPlaybookRunSystemDetails'),
        rbacRead,
        fifi.getSystemDetails);
};
