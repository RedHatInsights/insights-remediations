'use strict';

const controller = require('./generator.controller');
const openapi = require('../middleware/openapi');
const rbac = require('../middleware/rbac');

const rbacRead = rbac('remediations:resolution:read');

module.exports = function (router) {
    router.post('/playbook', openapi('generate'), rbacRead, controller.generate);
};
