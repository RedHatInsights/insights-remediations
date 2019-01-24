'use strict';

const controller = require('./resolutions.controller');

module.exports = function (router) {
    router.post('/resolutions', controller.resolutionsBatch);
    router.get('/resolutions/:id', controller.getResolutions);
};
