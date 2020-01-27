'use strict';

const controller = require('./generator.controller');
const openapi = require('../middleware/openapi');
const rbac = require('../middleware/rbac');

module.exports = function (router) {
    router.post('/playbook', openapi('generate'), rbac('remediations:resolution:read'), controller.generate);
};
