'use strict';

const controller = require('./resolutions.controller');
const openapi = require('../middleware/openapi');
const rbac = require('../middleware/rbac');

const rbacRead = rbac('remediations:resolution:read');

module.exports = function (router) {
    router.post('/resolutions',
        openapi('getResolutionsForIssues'),
        rbacRead,
        controller.resolutionsBatch);

    router.get('/resolutions/:issue',
        openapi('getResolutionsForIssue'),
        rbacRead,
        controller.getResolutions);
};
