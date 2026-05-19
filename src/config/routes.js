'use strict';

const controller = require('./config.controller');
const openapi = require('../middleware/openapi');
const orgAdmin = require('../middleware/identity/orgAdmin');

module.exports = function (router) {
    router.get('/config', openapi('getConfig'), controller.get);
    router.patch('/config', orgAdmin, openapi('updateConfig'), controller.patch);
    router.delete('/config/:field', orgAdmin, openapi('deleteConfigField'), controller.deleteConfig);
};
