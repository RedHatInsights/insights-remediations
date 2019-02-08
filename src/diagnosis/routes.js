'use strict';

const controller = require('./diagnosis.controller');
const openapi = require('../middleware/openapi');

module.exports = function (router) {
    router.get('/diagnosis/:system', openapi('diagnosis'), controller.getDiagnosis);
};
