'use strict';

const controller = require('./generator.controller');

module.exports = function (router) {
    router.post('/playbook', controller.generate);
};
