'use strict';

const controller = require('./generator.controller');
const openapi = require('../middleware/openapi');
const trace = require("../util/trace").middleware;

module.exports = function (router) {
    router.route('/playbook')
        .post(trace, openapi('generate'), controller.generate);
};
