'use strict';

const read = require('./controller.read');
const write = require('./controller.write');
const fifi = require('./controller.fifi');
const fifi2 = require('./controller.fifi_2');
const status = require('./controller.status');
const openapi = require('../middleware/openapi');
const rbac = require('../middleware/rbac');
const trace = require("../util/trace").middleware;

const rbacRead = rbac('remediations:remediation:read');
const rbacWrite = rbac('remediations:remediation:write');
const rbacExecute = rbac('remediations:remediation:execute');

module.exports = function (router) {
    router.route('/remediations')
        .get(trace, openapi('getRemediations'), rbacRead, read.list)
        .post(openapi('createRemediation'), rbacWrite, write.create)
        .delete(openapi('deleteRemediations'), rbacWrite, write.bulkRemove);

    router.get('/remediations/download', openapi('downloadPlaybooks'), rbacRead, read.downloadPlaybooks);

    router.route('/remediations/:id')
        .get(openapi('getRemediation'), rbacRead, read.get)
        .patch(openapi('updateRemediation'), rbacWrite, write.patch)
        .delete(openapi('deleteRemediation'), rbacWrite, write.remove);

    router.route('/remediations/:id/status')
        .get(trace, rbacRead, status.status);

    router.route('/remediations/:id/issues')
        .delete(openapi('deleteRemediationIssues'), rbacWrite, write.bulkRemoveIssues);

    router.route('/remediations/:id/issues/:issue')
        .patch(openapi('updateRemediationIssue'), rbacWrite, write.patchIssue)
        .delete(openapi('deleteRemediationIssue'), rbacWrite, write.removeIssue);

    router.route('/remediations/:id/issues/:issue/systems')
        .get(openapi('getRemediationIssueSystems'), rbacRead, read.getIssueSystems);

    router.route('/remediations/:id/issues/:issue/systems/:system')
        .delete(openapi('deleteRemediationIssueSystem'), rbacWrite, write.removeIssueSystem);

    router.route('/remediations/:id/systems')
        .delete(openapi('deleteRemediationSystems'), rbacWrite, write.bulkRemoveSystems);

    router.route('/remediations/:id/executable')
        .get(openapi('checkExecutable'), rbacRead, fifi.checkExecutable);

    router.route('/remediations/:id/connection_status')
        .get(trace, openapi('getRemediationConnectionStatus'), rbacExecute, fifi2.connection_status);

    router.route('/remediations/:id/playbook_runs')
        .get(openapi('listPlaybookRuns'), rbacRead, fifi.listPlaybookRuns)
        .post(openapi('runRemediation'), rbacExecute, fifi2.executePlaybookRuns);

    router.route('/remediations/:id/playbook_runs/:playbook_run_id')
        .get(openapi('getPlaybookRunDetails'), rbacRead, fifi.getRunDetails);

    router.route('/remediations/:id/playbook_runs/:playbook_run_id/cancel')
        .post(openapi('cancelPlaybookRuns'), rbacExecute, fifi.cancelPlaybookRuns);

    router.route('/remediations/:id/playbook_runs/:playbook_run_id/systems')
        .get(trace, openapi('getPlaybookRunSystems'), rbacRead, fifi.getSystems);

    router.route('/remediations/:id/playbook_runs/:playbook_run_id/systems/:system')
        .get(trace, openapi('getPlaybookRunSystemDetails'), rbacRead, fifi.getSystemDetails);
};
