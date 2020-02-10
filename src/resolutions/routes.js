'use strict';

const controller = require('./resolutions.controller');
const openapi = require('../middleware/openapi');

module.exports = function (router) {
    router.post('/resolutions',
        openapi('getResolutionsForIssues'),
        controller.resolutionsBatch);

    router.get('/resolutions/:issue',
        openapi('getResolutionsForIssue'),
        controller.getResolutions);
};
