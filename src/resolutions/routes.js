'use strict';

const controller = require('./resolutions.controller');
const openapi = require('../middleware/openapi');

module.exports = function (router) {
    router.post('/resolutions', openapi('resolutionsBatch'), controller.resolutionsBatch);
    router.get('/resolutions/:issue', openapi('resolutions'), controller.getResolutions);
};
