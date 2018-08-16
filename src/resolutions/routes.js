'use strict';

const controller = require('./resolutions.controller');

module.exports = function (router) {
    router.get('/resolutions/:id', controller.getResolutions);
};
