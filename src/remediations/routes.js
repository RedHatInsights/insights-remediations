'use strict';

const read = require('./controller.read');
const write = require('./controller.write');
const status = require('./controller.status');
const openapi = require('../middleware/openapi');

module.exports = function (router) {
    router.get('/remediations', openapi('listRemediations'), read.list);
    router.post('/remediations', openapi('createRemediation'), write.create);

    router.get('/remediations/:id', openapi('getRemediation'), read.get);
    router.patch('/remediations/:id', openapi('patchRemediation'), write.patch);
    router.delete('/remediations/:id', openapi('deleteRemediation'), write.remove);

    router.get('/remediations/:id/playbook', openapi('getRemediationPlaybook'), read.playbook);
    router.get('/remediations/:id/status', status.status); // TODO: openapi mw

    router.patch('/remediations/:id/issues/:issue', write.patchIssue);
    router.delete('/remediations/:id/issues/:issue', write.removeIssue);

    router.delete('/remediations/:id/issues/:issue/systems/:system', write.removeIssueSystem);
};
