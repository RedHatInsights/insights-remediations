'use strict';

const read = require('../controller.read');
const openapi = require('../../middleware/openapi');
const rbac = require('../../middleware/rbac');

const rbacRead = rbac('remediations:remediation:read');

module.exports = function (router) {
    router.get(
        '/remediations/:id/playbook',
        openapi('getRemediationPlaybook'),
        rbacRead,
        read.playbook);
};
