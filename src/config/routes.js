'use strict';

const controller = require('./config.controller');
const openapi = require('../middleware/openapi');

module.exports = function (router) {
    router.get('/config', openapi('getConfig'), controller.get);
    router.patch('/config', controller.requireOrgAdmin, openapi('updateConfig'), controller.patch);
};
