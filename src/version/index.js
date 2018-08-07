'use strict';

const controller = require('./version.controller');

module.exports = function (router) {
    router.get('/version', (req, res) => controller.get(req, res));
};
