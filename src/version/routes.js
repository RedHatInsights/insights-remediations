'use strict';

const controller = require('./version.controller');
const openapi = require('../middleware/openapi');

module.exports = function (router) {
    router.get('/version', openapi('getVersion'), (req, res) => controller.get(req, res));
};
