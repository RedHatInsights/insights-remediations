'use strict';

const controller = require('./status.controller');

module.exports = function (router, app) {
    router.get('/status', controller.status);
    app.get('/status', controller.status);
};
