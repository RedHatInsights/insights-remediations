'use strict';

const controller = require('./status.controller');

module.exports = function (router) {
    router.get('/status', controller.status);
};
