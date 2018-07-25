'use strict';

const controller = require('./version.controller');

module.exports = function (router) {
    router.get('/version', controller.get);
};
