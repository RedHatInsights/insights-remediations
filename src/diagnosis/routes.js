'use strict';

const controller = require('./diagnosis.controller');

module.exports = function (router) {
    router.get('/diagnosis/:id', controller.getDiagnosis);
};
