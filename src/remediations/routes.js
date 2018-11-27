'use strict';

const read = require('./controller.read');
const write = require('./controller.write');

module.exports = function (router) {
    router.get('/remediations', read.list);
    router.post('/remediations', write.create);

    router.get('/remediations/:id', read.get);
    router.patch('/remediations/:id', write.patch);
    router.delete('/remediations/:id', write.remove);

    router.patch('/remediations/:id/issues/:issue', write.patchIssue);
    router.delete('/remediations/:id/issues/:issue', write.removeIssue);

    router.delete('/remediations/:id/issues/:issue/systems/:system', write.removeIssueSystem);
};
