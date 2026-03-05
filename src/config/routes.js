'use strict';

const controller = require('./config.controller');
const openapi = require('../middleware/openapi');

module.exports = function (router) {
    router.get('/config', openapi('getConfig'), (req, res) => controller.get(req, res));
};
