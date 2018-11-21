'use strict';

const controller = require('./whoami.controller');

module.exports = function (router) {
    router.get('/whoami', (req, res) => controller.get(req, res));
};
