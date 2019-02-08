'use strict';

const controller = require('./generator.controller');
const openapi = require('../middleware/openapi');

module.exports = function (router) {
    router.post('/playbook', openapi('generate'), controller.generate);
};
