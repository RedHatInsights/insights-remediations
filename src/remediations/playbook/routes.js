'use strict';

const read = require('../controller.read');
const openapi = require('../../middleware/openapi');
const rbac = require('../../middleware/rbac');
const trace = require("../util/trace").middleware;

const rbacRead = rbac('remediations:remediation:read');

module.exports = function (router) {
    router.route('/remediations/:id/playbook')
        .get(trace, openapi('getRemediationPlaybook'), rbacRead, read.playbook)
        .post(openapi('bulkGetRemediationPlaybook'), rbacRead, read.bulkPlaybook);
};
