'use strict';

const controller = require('./config.controller');
const openapi = require('../middleware/openapi');
const orgAdmin = require('../middleware/identity/orgAdmin');

module.exports = function (router) {
    router.get('/config', openapi('getConfig'), controller.get);
    router.get('/config/defaults', openapi('getConfigDefaults'), controller.getDefaults);
    router.get('/config/overrides', openapi('getConfigOverrides'), controller.getOverrides);
    router.put('/config/overrides', orgAdmin, openapi('putConfigOverrides'), controller.putOverrides);
};
